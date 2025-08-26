var ZOTERO_CONFIG = {
	GUID: 'zotero@zotero.org',
	ID: 'zotero', // used for db filename, etc.
	CLIENT_NAME: 'DeepTutor',
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
	START_URL: "https://deeptutor.knowhiz.us/",
	QUICK_START_URL: "https://www.zotero.org/support/quick_start_guide",
	PDF_TOOLS_URL: "https://www.zotero.org/download/xpdf/",
	SUPPORT_URL: "https://deeptutor.knowhiz.us/",
	SYNC_INFO_URL: "https://www.zotero.org/support/sync",
	TROUBLESHOOTING_URL: "https://flashy-shad-05a.notion.site/DeepTutor-Use-Instruction-23237bc1a42180a58a5ce2453094891a?pvs=143",
	FEEDBACK_URL: "https://discord.gg/9DeAUAnnmV",
	CONNECTORS_URL: "https://www.zotero.org/download/connectors",
	CHANGELOG_URL: "https://flashy-shad-05a.notion.site/What-s-New-25a37bc1a42180018946ea3312a7454c?source=copy_link",
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
