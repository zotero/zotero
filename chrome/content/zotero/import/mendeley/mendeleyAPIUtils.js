// eslint-disable-next-line no-unused-vars
var mendeleyAPIUtils = (function () {
const OAUTH_URL = 'https://www.zotero.org/utils/mendeley/oauth';
const MENDELEY_API_URL = 'https://api.mendeley.com';

const getTokens = async (codeOrRefreshToken, isRefresh = false) => {
	const options = {
		body: isRefresh
			? `grant_type=refresh_token&refresh_token=${codeOrRefreshToken}`
			: `grant_type=authorization_code&code=${codeOrRefreshToken}`,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		}
	};
	const response = await Zotero.HTTP.request('POST', OAUTH_URL, options);

	return JSON.parse(response.responseText);
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
	options = { ...options, headers };
	const method = 'GET';

	// Run the request. If we see 401 or 403, try to refresh tokens and run the request again
	try {
		return await Zotero.HTTP.request(method, url, options);
	}
	catch (e) {
		if (e.status === 401 || e.status === 403) {
			const newTokens = await getTokens(tokens.refresh_token, true);
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

const getAll = async (tokens, endPoint, params = {}, headers = {}, options = {}) => {
	const PER_PAGE = endPoint === 'annotations' ? 200 : 500;
	const response = await apiFetch(tokens, endPoint, { ...params, limit: PER_PAGE }, headers, options);
	var next = getNextLinkFromResponse(response);
	var data = JSON.parse(response.responseText);
	
	while (next) {
		const response = await apiFetchUrl(tokens, next, headers, options); //eslint-disable-line no-await-in-loop
		data = [...data, ...JSON.parse(response.responseText)];
		next = getNextLinkFromResponse(response);
	}

	return data;
};


return { getNextLinkFromResponse, getTokens, apiFetch, apiFetchUrl, get, getAll };
})();
