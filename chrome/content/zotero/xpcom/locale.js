Zotero.Locale = {
	/**
	 * Keep this up to date with app/assets/multilocale.txt,
	 * scripts/dictionaries/build-dictionaries, and possibly chrome.manifest
	 *
	 * Names from https://addons.mozilla.org/en-US/firefox/language-tools/
	 */
	availableLocales: Object.freeze({
		'ar': 'عربي',
		'bg-BG': 'Български',
		'br': 'brezhoneg',
		'ca-AD': 'Català',
		'cs-CZ': 'Čeština',
		'da-DK': 'Dansk',
		'de': 'Deutsch',
		'el-GR': 'Ελληνικά',
		'en-AU': 'English (Australian)',
		'en-CA': 'English (Canada)',
		'en-US': 'English',
		'en-GB': 'English (UK)',
		'en-NZ': 'English (New Zealand)',
		'es-ES': 'Español',
		'et-EE': 'Eesti keel',
		'eu-ES': 'Euskara',
		'fa': 'فارسی',
		'fi-FI': 'suomi',
		'fr-FR': 'Français',
		'gl-ES': 'Galego',
		'hu-HU': 'magyar',
		'id-ID': 'Bahasa Indonesia',
		'is-IS': 'íslenska',
		'it-IT': 'Italiano',
		'ja-JP': '日本語',
		'km': 'ខ្មែរ',
		'ko-KR': '한국어',
		'lt-LT': 'Lietuvių',
		'nl-NL': 'Nederlands',
		'nb-NO': 'Norsk bokmål',
		'pl-PL': 'Polski',
		'pt-BR': 'Português (do Brasil)',
		'pt-PT': 'Português (Europeu)',
		'ro-RO': 'Română',
		'ru-RU': 'Русский',
		'sk-SK': 'slovenčina',
		'sl-SI': 'Slovenščina',
		'sr-RS': 'Српски',
		'sv-SE': 'Svenska',
		'th-TH': 'ไทย',
		'tr-TR': 'Türkçe',
		'uk-UA': 'Українська',
		'vi-VN': 'Tiếng Việt',
		'zh-CN': '中文 (简体)',
		'zh-TW': '正體中文 (繁體)'
	}),

	defaultScriptDirection(locale) {
		switch (locale.split('-')[0]) {
			case 'ar':
			case 'fa':
			case 'he':
				return 'rtl';
			default:
				return 'ltr';
		}
	}
}
