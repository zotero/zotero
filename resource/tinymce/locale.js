// Available language packs
var locales = [
	'ar',
	'bg_BG',
	'ca',
	'cs_CZ',
	'da',
	'de',
	'el',
	'es',
	'et',
	'eu',
	'fa_IR',
	'fi',
	'fr_FR',
	'gl',
	'he_IL',
	'hr',
	'hu_HU',
	'id',
	'is_IS',
	'it',
	'ja',
	'km_KH',
	'ko_KR',
	'lt',
	'nb_NO',
	'nl',
	'pl',
	'pt_BR',
	'pt_PT',
	'ro',
	'ru',
	'sk',
	'sl_SI',
	'sv_SE',
	'th_TH',
	'tr_TR',
	'uk',
	'vi_VN',
	'zh_CN',
	'zh_TW'
];

function setLocale(editor) {
	var locale = 'en';
	
	var matches = window.location.href.match(/locale=([^&]+)/);
	if (matches) {
		let code = matches[1].replace('-', '_');
		// Exact match
		if (locales.includes(code)) {
			locale = code;
		}
		else {
			let prefix = code.substr(0, 2);
			// Match on first two characters, exact
			if (locales.includes(prefix)) {
				locale = prefix;
			}
			// Match on first two characters with additional country code (e.g., 'fa' -> 'fa_IR')
			else {
				for (let l of locales) {
					if (l.substr(0, 2) == prefix) {
						locale = l;
						break;
					}
				}
			}
		}
	}
	
	editor.settings.language = locale;
}
