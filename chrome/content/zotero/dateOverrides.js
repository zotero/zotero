/* eslint-disable no-extend-native */
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

let originalToLocaleString = Date.prototype.toLocaleString;
Date.prototype.toLocaleString = function (locales, options) {
	if (locales === undefined || (Array.isArray(locales) && !locales.length)) {
		locales = Services.locale.requestedLocales;
	}
	return originalToLocaleString.call(this, locales, options);
};

let originalToLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function (locales, options) {
	if (locales === undefined || (Array.isArray(locales) && !locales.length)) {
		locales = Services.locale.requestedLocales;
	}
	return originalToLocaleDateString.call(this, locales, options);
};
