// eslint-disable-next-line no-unused-vars
var mendeleyAPIUtils = (function () {
const ZOTERO_OAUTH_URL = 'https://www.zotero.org/utils/mendeley/oauth';
const OAUTH_URL = 'https://api.mendeley.com/oauth/token';
const MENDELEY_API_URL = 'https://api.mendeley.com';
const CLIENT_ID = '6';
const CLIENT_NOT_VERY_SECRET = 'JtSAMzFdwC6RAED3RMZU';
const USER_AGENT = 'Mendeley Desktop/1.18';
const API_DATA_TIMEOUT = 60000;
const API_TOKEN_TIMEOUT = 30000;
const ACCESS_TOKEN_TIMEOUT = 15000;

const getTokens = async (url, bodyProps, headers = {}, options = {}) => {
	const body = Object.entries(bodyProps)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&');

	headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
	
	if (!Zotero.Prefs.get('import.mendeleyUseOAuth')) {
		headers['User-Agent'] = USER_AGENT;
	}

	options = { ...options, body, headers, timeout: API_TOKEN_TIMEOUT };
	const response = await Zotero.HTTP.request('POST', url, options);
	const parsedResponse = JSON.parse(response.responseText);
	
	return {
		kind: Zotero.Prefs.get('import.mendeleyUseOAuth') ? 'oauth' : 'direct',
		accessToken: parsedResponse.access_token, // eslint-disable-line camelcase
		refreshToken: parsedResponse.refresh_token // eslint-disable-line camelcase
	};
};

const directAuth = async (username, password, headers = {}, options = {}) => {
	const bodyProps = {
		client_id: CLIENT_ID, // eslint-disable-line camelcase
		client_secret: CLIENT_NOT_VERY_SECRET, // eslint-disable-line camelcase
		grant_type: 'password', // eslint-disable-line camelcase
		password,
		scope: 'all',
		username
	};

	const tokens = await getTokens(OAUTH_URL, bodyProps, headers, options);
	return { username, password, tokens };
};

const codeAuth = async (code, headers = {}, options = {}) => {
	const bodyProps = {
		grant_type: 'authorization_code', // eslint-disable-line camelcase
		code,
	};

	return getTokens(ZOTERO_OAUTH_URL, bodyProps, headers, options);
};

const refreshAuth = async (refreshToken, headers = {}, options = {}) => {
	const bodyProps = {
		grant_type: 'refresh_token', // eslint-disable-line camelcase
		refresh_token: refreshToken, // eslint-disable-line camelcase
	};

	if (!Zotero.Prefs.get('import.mendeleyUseOAuth')) {
		bodyProps.client_id = CLIENT_ID; // eslint-disable-line camelcase
		bodyProps.client_secret = CLIENT_NOT_VERY_SECRET; // eslint-disable-line camelcase
	}

	return getTokens(
		Zotero.Prefs.get('import.mendeleyUseOAuth') ? ZOTERO_OAUTH_URL : OAUTH_URL,
		bodyProps, headers, options
	);
};

const getNextLinkFromResponse = (response) => {
	let next = null;
	let links = response.getResponseHeader('link');
	if (links) {
		const matches = links.match(/<(.*?)>;\s+rel="next"/i);

		if (matches && matches.length > 1) {
			next = matches[1];
		}
	}
	return next;
};


const apiFetchUrl = async (tokens, url, headers = {}, options = {}) => {
	headers = { ...headers, Authorization: `Bearer ${tokens.accessToken}` };
	options = { ...options, headers, timeout: API_DATA_TIMEOUT };
	const method = 'GET';

	// Run the request. If we see 401 or 403, try to refresh tokens and run the request again
	try {
		return await Zotero.HTTP.request(method, url, options);
	}
	catch (e) {
		if (e.status === 401 || e.status === 403) {
			if (tokens.kind === 'referenceManager') {
				const newToken = await obtainReferenceManagerTokenWithRetry(tokens.username, tokens.password);
				tokens.accessToken = newToken;
				headers.Authorization = `Bearer ${tokens.accessToken}`;
			}
			else {
				const newTokens = await refreshAuth(tokens.refreshToken);
				// update tokens in the tokens object and in the header for next request
				tokens.accessToken = newTokens.accessToken;
				tokens.refreshToken = newTokens.refreshToken;
				headers.Authorization = `Bearer ${tokens.accessToken}`;
			}
		}
	}

	return Zotero.HTTP.request(method, url, options);
};

const apiFetch = async (tokens, endPoint, params = {}, headers = {}, options = {}) => {
	const stringParams = Object.entries(params).map(p => p.join('=')).join('&');
	const url = `${MENDELEY_API_URL}/${endPoint}${stringParams.length ? '?' + stringParams : ''}`;
	return apiFetchUrl(tokens, url, headers, options);
};

const get = async (tokens, endPoint, params = {}, headers = {}, options = {}) => {
	const response = await apiFetch(tokens, endPoint, params, headers, options);
	return JSON.parse(response.responseText);
};

const getAll = async (tokens, endPoint, params = {}, headers = {}, options = {}, interruptChecker = () => {}) => {
	const PER_PAGE = endPoint === 'annotations' ? 200 : 500;
	const response = await apiFetch(tokens, endPoint, { ...params, limit: PER_PAGE }, headers, options);
	var next = getNextLinkFromResponse(response);
	var data = JSON.parse(response.responseText);
	interruptChecker();
	
	while (next) {
		const response = await apiFetchUrl(tokens, next, headers, options); //eslint-disable-line no-await-in-loop
		data = [...data, ...JSON.parse(response.responseText)];
		next = getNextLinkFromResponse(response);
		interruptChecker();
	}

	return data;
};

/**
 * Obtain Reference Manager access token
 *
 * This function automates the process of logging into Mendeley Reference Manager and retrieving an
 * access token. It uses a hidden browser to navigate through the login process and extract the
 * access token from the cookies once logged in. This token enables access to some features
 * not available through the normal API token (e.g. notebooks).
 *
 * @param {string} login - The login email for the Mendeley account.
 * @param {string} password - The password for the Mendeley account.
 * @returns {Promise<string>} - A promise that resolves to the Mendeley access token.
 * @throws {Error} - Throws an error if login fails, or if the access token cannot be obtained.
 */
const obtainReferenceManagerToken = async (login, password) => {
	let { HiddenBrowser } = ChromeUtils.import("chrome://zotero/content/HiddenBrowser.jsm");
	let cookieSandbox = new Zotero.CookieSandbox({});
	let browser = new HiddenBrowser({
		cookieSandbox,
		docShell: {
			allowMetaRedirects: true,
			allowAuth: true,
		}
	});
	await browser._createdPromise;

	return new Promise((resolve, reject) => {
		let hasEnteredLogin = false;
		let hasEnteredPassword = false;

		browser.webProgress.addProgressListener({
			QueryInterface: ChromeUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
			async onLocationChange() {
				let url = browser.currentURI.spec;
				Zotero.debug(`Obtain Mendeley access token, visiting "${url}"`, 5);
				if (url.startsWith("https://id.elsevier.com/as/authorization.oauth2")) {
					Zotero.debug("Logging in to Mendeley Reference Manager");
					if (!hasEnteredLogin) {
						hasEnteredLogin = await browser.browsingContext.currentWindowGlobal
							.getActor("MendeleyAuth")
							.sendQuery("login", { login });
						if (!hasEnteredLogin) {
							browser.destroy();
							reject(new Error("Failed to enter login"));
						}
					}
				}
				else if (url.match(/https:\/\/id.elsevier.com\/as\/(.*?)\/resume\/as/)) {
					Zotero.debug("Entering password to the Mendeley Reference Manager");
					if (!hasEnteredPassword) {
						hasEnteredPassword = await browser.browsingContext.currentWindowGlobal
							.getActor("MendeleyAuth")
							.sendQuery("password", { password });
						if (!hasEnteredPassword) {
							browser.destroy();
							reject(new Error("Failed to enter password"));
						}
					}
				}
				else if (url.startsWith("https://www.mendeley.com/reference-manager/library")) {
					const cookies = cookieSandbox.getCookiesForURI(
						Services.io.newURI("https://www.mendeley.com/reference-manager/library")
					);
					browser.destroy();
					if (!cookies.accessToken) {
						reject(new Error("Failed to obtain Mendeley access token"));
					}
					resolve(cookies.accessToken);
				}
				else {
					Zotero.debug(`Ignoring unexpected URL while obtaining Mendeley access token: ${url}`);
				}
			}
		}, Ci.nsIWebProgress.NOTIFY_LOCATION);

		browser.load("https://www.mendeley.com/sign-in?routeTo=https://www.mendeley.com/reference-manager/library/");
		Zotero.Promise.delay(ACCESS_TOKEN_TIMEOUT).then(() => {
			browser.destroy();
			reject(new Error("Timed out while obtaining Mendeley access token"));
		});
	});
};

const obtainReferenceManagerTokenWithRetry = async (login, password, tries = 3) => {
	for (let i = 0; i < tries; i++) {
		try {
			return await obtainReferenceManagerToken(login, password);
		}
		catch (e) {
			if (i === tries - 1) {
				throw e;
			}
			Zotero.debug(`Failed to obtain Reference Manager token on attempt ${i + 1}. Retrying...`);
		}
	}
	return null;
};

return { codeAuth, directAuth, getNextLinkFromResponse, apiFetch, apiFetchUrl, get, getAll, obtainReferenceManagerToken, obtainReferenceManagerTokenWithRetry };
})();
