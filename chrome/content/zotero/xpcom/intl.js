/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2018 Center for History and New Media
					George Mason University, Fairfax, Virginia, USA
					http://zotero.org
	
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
Zotero.Intl = new function () {
	let bundle;
	let intlProps;
	let pluralFormGet;
	let pluralFormNumForms;

	// Get settings from language pack (extracted by zotero-build/locale/merge_mozilla_files)
	this.init = function () {
		Components.utils.import("resource://gre/modules/PluralForm.jsm");

		bundle = Services.strings.createBundle('chrome://zotero/locale/zotero.properties');
		intlProps = Services.strings.createBundle('chrome://zotero/locale/mozilla/intl.properties');

		[pluralFormGet, pluralFormNumForms] = PluralForm.makeGetter(parseInt(getIntlProp('pluralRule', 1)));
		setOrClearIntlPref('intl.accept_languages', 'string');

		Zotero.locale = getIntlProp('general.useragent.locale', 'en-US');

		// Also load the brand as appName
		Zotero.appName = Services.strings
			.createBundle('chrome://branding/locale/brand.properties')
			.GetStringFromName('brandShortName');
		
		// Set the locale direction to Zotero.dir
		Zotero.dir = 'ltr';

		// TODO: is there a better way to get the entity from JS?
		if (!(Zotero.isNode || Zotero.isElectron)) {
			let xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
			xmlhttp.open('GET', 'chrome://global/locale/global.dtd', false);
			xmlhttp.overrideMimeType('text/plain');
			xmlhttp.send(null);
			let matches = xmlhttp.responseText.match(/(ltr|rtl)/);
			if (matches && matches[0] == 'rtl') {
				Zotero.dir = 'rtl';
			}
		}

		Zotero.rtl = (Zotero.dir === 'rtl');
	};


	function getIntlProp(name, fallback = null) {
		try {
			return intlProps.GetStringFromName(name);
		}
		catch (e) {
			Zotero.logError(`Couldn't load ${name} from intl.properties`);
			return fallback;
		}
	}

	function setOrClearIntlPref(name, type) {
		var val = getIntlProp(name);
		if (val !== null) {
			if (type == 'boolean') {
				val = val == 'true';
			}
			Zotero.Prefs.set(name, val, true);
		}
		else {
			Zotero.Prefs.clear(name, true);
		}
	}

	/**
	 * @param {String} name
	 * @param {String[]} [params=[]] - Strings to substitute for placeholders
	 * @param {Number} [num] - Number (also appearing in `params`) to use when determining which plural
	 *     form of the string to use; localized strings should include all forms in the order specified
	 *     in https://developer.mozilla.org/en-US/docs/Mozilla/Localization/Localization_and_Plurals,
	 *     separated by semicolons
	 */
	this.getString = function (name, params, num) {
		try {
			var l10n;
			if (params != undefined) {
				if (typeof params != 'object'){
					params = [params];
				}
				l10n = bundle.formatStringFromName(name, params, params.length);
			}
			else {
				l10n = bundle.GetStringFromName(name);
			}
			if (num !== undefined) {
				let availableForms = l10n.split(/;/);
				// If not enough available forms, use last one -- PluralForm.get() uses first by
				// default, but it's more likely that a localizer will translate the two English
				// strings with some plural form as the second one, so we might as well use that
				if (availableForms.length < pluralFormNumForms()) {
					l10n = availableForms[availableForms.length - 1];
				}
				else {
					l10n = pluralFormGet(num, l10n);
				}
			}
		}
		catch (e){
			if (e.name == 'NS_ERROR_ILLEGAL_VALUE') {
				Zotero.debug(params, 1);
			}
			else if (e.name != 'NS_ERROR_FAILURE') {
				Zotero.logError(e);
			}
			throw new Error('Localized string not available for ' + name);
		}
		return l10n;
	};
};
