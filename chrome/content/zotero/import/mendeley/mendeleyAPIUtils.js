// eslint-disable-next-line no-unused-vars
var mendeleyAPIUtils = (function () {
const ZOTERO_OAUTH_URL = 'https://www.zotero.org/utils/mendeley/oauth';
const OAUTH_URL = 'https://api.mendeley.com/oauth/token';
const MENDELEY_API_URL = 'https://api.mendeley.com';
const CLIENT_ID = '6';
const CLIENT_NOT_VERY_SECRET = 'JtSAMzFdwC6RAED3RMZU';
const USER_AGENT = 'Mendeley Desktop/1.18';

const getTokens = async (url, bodyProps, headers = {}, options = {}) => {
	const body = Object.entries(bodyProps)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
		.join('&');

	headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
	
	if (!Zotero.Prefs.get('import.mendeleyUseOAuth')) {
		headers['User-Agent'] = USER_AGENT;
	}

	options = { ...options, body, headers, timeout: 30000 };
	const response = await Zotero.HTTP.request('POST', url, options);
	return JSON.parse(response.responseText);
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

	return getTokens(OAUTH_URL, bodyProps, headers, options);
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
	headers = { ...headers, Authorization: `Bearer ${tokens.access_token}` };
	options = { ...options, headers, timeout: 60000 };
	const method = 'GET';

	// Run the request. If we see 401 or 403, try to refresh tokens and run the request again
	try {
		return await Zotero.HTTP.request(method, url, options);
	}
	catch (e) {
		if (e.status === 401 || e.status === 403) {
			const newTokens = await refreshAuth(tokens.refresh_token);
			// update tokens in the tokens object and in the header for next request
			tokens.access_token = newTokens.access_token; // eslint-disable-line camelcase
			tokens.refresh_token = newTokens.refresh_token; // eslint-disable-line camelcase
			headers.Authorization = `Bearer ${tokens.access_token}`;
		}
	}

	return Zotero.HTTP.request(method, url, options);
};

const apiFetch = async (tokens, endPoint, params = {}, headers = {}, options = {}) => {
	const stringParams = Object.entries(params).map(p => p.join('=')).join('&');
	const url = MENDELEY_API_URL + '/' + endPoint + '?' + stringParams;
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

return { codeAuth, directAuth, getNextLinkFromResponse, apiFetch, apiFetchUrl, get, getAll };
})();
