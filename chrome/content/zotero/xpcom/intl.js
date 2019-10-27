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
	let collation;
	let intlProps;
	let pluralFormGet;
	let pluralFormNumForms;

	// Get settings from language pack (extracted by zotero-build/locale/merge_mozilla_files)
	this.init = function () {
		var prevMatchOS = Zotero.Prefs.get('intl.locale.matchOS', true);
		var prevLocale = Zotero.Prefs.get('general.useragent.locale', true);
		
		if (prevMatchOS !== undefined || prevLocale !== undefined) {
			let restart = false;
			if (prevMatchOS === false && prevLocale) {
				try {
					Services.locale.setRequestedLocales([prevLocale]);
					restart = true;
				}
				catch (e) {
					// Don't panic if the value is not a valid locale code
				}
			}
			Zotero.Prefs.clear('intl.locale.matchOS', true);
			Zotero.Prefs.clear('general.useragent.locale', true);
			if (restart) {
				Zotero.Utilities.Internal.quitZotero(true);
				return;
			}
        }
		
		Components.utils.import("resource://gre/modules/PluralForm.jsm");

		bundle = Services.strings.createBundle('chrome://zotero/locale/zotero.properties');
		intlProps = Services.strings.createBundle('chrome://zotero/locale/mozilla/intl.properties');

		[pluralFormGet, pluralFormNumForms] = PluralForm.makeGetter(parseInt(getIntlProp('pluralRule', 1)));
		setOrClearIntlPref('intl.accept_languages', 'string');

		Zotero.locale = Zotero.Utilities.Internal.resolveLocale(
			Services.locale.getRequestedLocale(),
			Services.locale.getAvailableLocales()
		);

		// Also load the brand as appName
		Zotero.appName = Services.strings
			.createBundle('chrome://branding/locale/brand.properties')
			.GetStringFromName('brandShortName');
		
		// Set the locale direction to Zotero.dir
		Zotero.dir = Zotero.Locale.defaultScriptDirection(Zotero.locale);
		Zotero.rtl = (Zotero.dir === 'rtl');
		
		this.strings = {};
		const intlFiles = ['zotero.dtd'];
		for (let intlFile of intlFiles) {
			let localeXML = Zotero.File.getContentsFromURL(`chrome://zotero/locale/${intlFile}`);
			let regexp = /<!ENTITY ([^\s]+)\s+"([^"]+)/g;
			let regexpResult;
			while (regexpResult = regexp.exec(localeXML)) {
				this.strings[regexpResult[1]] = regexpResult[2];
			}
		}
	};


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

	/*
	 * Compares two strings based on the current collator.
	 * @param {String} string1
	 * @param {String} string2
	 * @return {Number} a number indicating how string1 and string2 compare to
	 *     each other according to the sort order of this Collator object: a
	 *     negative value if string1 comes before string2; a positive value if
	 *     string1 comes after string2; 0 if they are considered equal.
	 */
	this.compare = function (...args) {
		return this.collation.compareString(1, ...args);
	};

	Object.defineProperty(this, 'collation', {
		get() {
			if (collation == null) {
				collation = getLocaleCollation();
			}
			return collation;
		}
	});


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

	function getLocaleCollation() {
		try {
			// DEBUG: Is this necessary, or will Intl.Collator just default to the same locales we're
			// passing manually?

			let locales;
			// Fx55+
			if (Services.locale.getAppLocalesAsBCP47) {
				locales = Services.locale.getAppLocalesAsBCP47();
			}
			else {
				let locale;
				// Fx54
				if (Services.locale.getAppLocale) {
					locale = Services.locale.getAppLocale();
				}
				// Fx <=53
				else {
					locale = Services.locale.getApplicationLocale();
					locale = locale.getCategory('NSILOCALE_COLLATE');
				}

				// Extract a valid language tag
				try {
					locale = locale.match(/^[a-z]{2}(\-[A-Z]{2})?/)[0];
				}
				catch (e) {
					throw new Error(`Error parsing locale ${locale}`);
				}
				locales = [locale];
			}

			var collator = new Intl.Collator(locales, {
				numeric: true,
				sensitivity: 'base'
			});
		}
		catch (e) {
			Zotero.logError(e);

			// Fall back to en-US sorting
			try {
				Zotero.logError("Falling back to en-US sorting");
				collator = new Intl.Collator(['en-US'], {
					numeric: true,
					sensitivity: 'base'
				});
			}
			catch (e) {
				Zotero.logError(e);

				// If there's still an error, just skip sorting
				collator = {
					compare: function (a, b) {
						return 0;
					}
				};
			}
		}

		// Grab all ASCII punctuation and space at the beginning of string
		var initPunctuationRE = /^[\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]+/;
		// Punctuation that should be ignored when sorting
		var ignoreInitRE = /["'[{(]+$/;

		// Until old code is updated, pretend we're returning an nsICollation
		return this.collation = {
			compareString: function (_, a, b) {
				if (!a && !b) return 0;
				if (!a || !b) return b ? -1 : 1;

				// Compare initial punctuation
				var aInitP = initPunctuationRE.exec(a) || '';
				var bInitP = initPunctuationRE.exec(b) || '';

				var aWordStart = 0, bWordStart = 0;
				if (aInitP) {
					aWordStart = aInitP[0].length;
					aInitP = aInitP[0].replace(ignoreInitRE, '');
				}
				if (bInitP) {
					bWordStart = bInitP.length;
					bInitP = bInitP[0].replace(ignoreInitRE, '');
				}

				// If initial punctuation is equivalent, use collator comparison
				// that ignores all punctuation
				//
				// Update: Intl.Collator's ignorePunctuation also ignores whitespace, so we're
				// no longer using it, meaning we could take out most of the code to handle
				// initial punctuation separately, unless we think we'll at some point switch to
				// a collation function that ignores punctuation but not whitespace.
				if (aInitP == bInitP || !aInitP && !bInitP) return collator.compare(a, b);

				// Otherwise consider "attached" words as well, e.g. the order should be
				// "__ n", "__z", "_a"
				// We don't actually care what the attached word is, just whether it's
				// there, since at this point we're guaranteed to have non-equivalent
				// initial punctuation
				if (aWordStart < a.length) aInitP += 'a';
				if (bWordStart < b.length) bInitP += 'a';

				return aInitP.localeCompare(bInitP);
			}
		};
	}
};
