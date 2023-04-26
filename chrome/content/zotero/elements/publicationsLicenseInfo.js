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
	const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);

	const links = {
		cc: 'https://wiki.creativecommons.org/Considerations_for_licensors_and_licensees',
		cc0: 'https://wiki.creativecommons.org/CC0_FAQ'
	};

	const getLicenseData = (license) => {
		var name, img, url, id;

		switch (license) {
			case 'reserved':
				url = null;
				name = 'All rights reserved';
				img = 'chrome://zotero/skin/licenses/reserved.png';
				id = null;
				break;
			case 'cc':
				url = 'https://creativecommons.org/';
				name = 'Creative Commons';
				img = 'chrome://zotero/skin/licenses/cc-srr.png';
				id = null;
				break;

			case 'cc0':
				url = "https://creativecommons.org/publicdomain/zero/1.0/";
				name = null;
				img = 'chrome://zotero/skin/licenses/' + license + ".svg";
				id = 'licenses-cc-0';
				break;

			default:
				url = 'https://creativecommons.org/licenses/' + license.replace(/^cc-/, '') + '/4.0/';
				name = null;
				img = 'chrome://zotero/skin/licenses/' + license + ".svg";
				id = `licenses-${license}`;
				break;
		}

		return { url, name, img, id };
	};

	const makeLicenseInfo = (url, name, img, id) => {
		const licenseInfo = `<div class="license-icon"><img title="${url}" src="${img}" /></div>`
			+ (id ? `<div class="license-name" data-l10n-id="${id}" />` : `<div class="license-name">${name}</div>`);
		
		return MozXULElement.parseXULToFragment(
			url
				? `<a xmlns="http://www.w3.org/1999/xhtml" class="license-info" href="${url}">${licenseInfo}</a>`
				: `<div xmlns="http://www.w3.org/1999/xhtml" class="license-info">${licenseInfo}</div>`
		);
	};

	const makeLicenseMoreInfo = (license) => {
		const needsMoreInfo = license.startsWith('cc') && license !== 'cc';
		const ccType = license === 'cc0' ? 'cc0' : 'cc';

		return MozXULElement.parseXULToFragment(needsMoreInfo
			? `<div xmlns="http://www.w3.org/1999/xhtml" class="license-more-info" data-l10n-id="licenses-${ccType}-more-info">
				<a href="${links[ccType]}" data-l10n-name="license-considerations" />
			</div>`
			: ''
		);
	};

	class PublicationsLicenseInfo extends XULElementBase {
		get stylesheets() {
			return [
				'chrome://global/skin/global.css',
				'chrome://zotero/skin/elements/license-info.css'
			];
		}

		content = MozXULElement.parseXULToFragment(`
			<div id="license-info"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
			</div>
		`);

		validLicenses = new Set(['cc', 'cc-by', 'cc-by-sa', 'cc-by-nd', 'cc-by-nc', 'cc-by-nc-sa', 'cc-by-nc-nd', 'cc0', 'reserved']);

		get license() {
			return this._license;
		}

		set license(val) {
			if (!this.validLicenses.has(val)) {
				throw new Zotero.Error(`"${val}" is invalid value for attribute "license" in <licenseinfo>`);
			}
			this._license = val;
			this.update();
		}

		get licenseName() {
			return this.querySelector('.license-name').getAttribute('label')
				? this.querySelector('.license-name').getAttribute('label')
				: this.querySelector('.license-name').textContent;
		}

		async init() {
			this.license = this.getAttribute('license');
			this.querySelector('#license-info').addEventListener('click', this.onURLInteract.bind(this));
			this.querySelector('#license-info').addEventListener('keydown', this.onURLInteract.bind(this));
		}

		update() {
			const { url, name, img, id } = getLicenseData(this.license);
			const licenseInfoEl = makeLicenseInfo(url, name, img, id);
			const licenseMoreEl = makeLicenseMoreInfo(this.license);
			this.querySelector('#license-info').replaceChildren(licenseInfoEl, licenseMoreEl);
		}

		onURLInteract(ev) {
			const aEl = ev.target.closest('[href]');
			if (aEl && (ev.type === 'click' || (ev.type === 'keydown' && ev.key === ' '))) {
				ev.preventDefault();
				Zotero.launchURL(aEl.getAttribute('href'));
			}
		}
	}
	customElements.define('publications-license-info', PublicationsLicenseInfo);
}
