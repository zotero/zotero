var ZOTERO_CONFIG = {
	GUID: 'zotero@chnm.gmu.edu',
	ID: 'zotero', // used for db filename, etc.
	CLIENT_NAME: 'Zotero',
	DOMAIN_NAME: 'zotero.org',
	REPOSITORY_URL: 'https://repo.zotero.org/repo/',
	REPOSITORY_CHECK_INTERVAL: 86400, // 24 hours
	REPOSITORY_RETRY_INTERVAL: 3600, // 1 hour
	BASE_URI: 'http://zotero.org/',
	WWW_BASE_URL: 'https://www.zotero.org/',
	PROXY_AUTH_URL: 'https://s3.amazonaws.com/zotero.org/proxy-auth',
	API_URL: 'https://api.zotero.org/',
	STREAMING_URL: 'wss://stream.zotero.org/',
	API_VERSION: 3,
	PREF_BRANCH: 'extensions.zotero.',
	BOOKMARKLET_ORIGIN: 'https://www.zotero.org',
	HTTP_BOOKMARKLET_ORIGIN: 'http://www.zotero.org',
	BOOKMARKLET_URL: 'https://www.zotero.org/bookmarklet/',
	START_URL: "https://www.zotero.org/start",
	QUICK_START_URL: "https://www.zotero.org/support/quick_start_guide",
	PDF_TOOLS_URL: "https://www.zotero.org/download/xpdf/",
	SUPPORT_URL: "https://www.zotero.org/support/",
	TROUBLESHOOTING_URL: "https://www.zotero.org/support/getting_help",
	FEEDBACK_URL: "https://forums.zotero.org/",
	CONNECTORS_URL: "https://www.zotero.org/download/connectors"
};

EXPORTED_SYMBOLS = ["ZOTERO_CONFIG"];
