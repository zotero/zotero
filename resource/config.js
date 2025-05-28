var ZOTERO_CONFIG = {
	GUID: 'zotero@zotero.org',
	ID: 'zotero', // used for db filename, etc.
	CLIENT_NAME: 'Zotero',
	DOMAIN_NAME: 'zotero.org',
	PRODUCER: 'Digital Scholar',
	PRODUCER_URL: 'https://digitalscholar.org',
	REPOSITORY_URL: 'https://repo.zotero.org/repo/',
	BASE_URI: 'http://zotero.org/',
	WWW_BASE_URL: 'https://www.zotero.org/',
	PROXY_AUTH_URL: 'https://zoteroproxycheck.s3.amazonaws.com/test',
	API_URL: 'https://api.zotero.org/',
	STREAMING_URL: 'wss://stream.zotero.org/',
	SERVICES_URL: 'https://services.zotero.org/',
	API_VERSION: 3,
	CONNECTOR_MIN_VERSION: '5.0.39', // show upgrade prompt for requests from below this version
	PREF_BRANCH: 'extensions.zotero.',
	BOOKMARKLET_ORIGIN: 'https://www.zotero.org',
	BOOKMARKLET_URL: 'https://www.zotero.org/bookmarklet/',
	START_URL: "https://www.zotero.org/start",
	QUICK_START_URL: "https://www.zotero.org/support/quick_start_guide",
	PDF_TOOLS_URL: "https://www.zotero.org/download/xpdf/",
	SUPPORT_URL: "https://www.zotero.org/support/",
	SYNC_INFO_URL: "https://www.zotero.org/support/sync",
	TROUBLESHOOTING_URL: "https://www.zotero.org/support/getting_help",
	FEEDBACK_URL: "https://forums.zotero.org/",
	CONNECTORS_URL: "https://www.zotero.org/download/connectors",
	CHANGELOG_URL: "https://www.zotero.org/support/changelog",
	CREDITS_URL: 'https://www.zotero.org/support/credits_and_acknowledgments',
	LICENSING_URL: 'https://www.zotero.org/support/licensing',
	GET_INVOLVED_URL: 'https://www.zotero.org/getinvolved',
	DICTIONARIES_URL: 'https://download.zotero.org/dictionaries/',
	PLUGINS_URL: 'https://www.zotero.org/support/plugins',
	NEW_FEATURES_URL: 'https://www.zotero.org/blog/zotero-7/',
	NEXT_PUBLIC_API_BASE_URL: 'https://api.staging.deeptutor.knowhiz.us/api'
};

if (typeof exports === 'object' && typeof module !== 'undefined') {
	module.exports = ZOTERO_CONFIG;
}
else {
	var EXPORTED_SYMBOLS = ["ZOTERO_CONFIG"];
}
