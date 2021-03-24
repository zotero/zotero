// eslint-disable-next-line no-unused-vars
var mendeleyAPIUtils = (function () {
const MENDELEY_API_URL = 'https://api.mendeley.com';

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

const apiFetchUrl = async (token, url, headers = {}, options = {}) => {
	headers = { ...headers, Authorization: `Bearer ${token}` };
	return Zotero.HTTP.request('GET', url, { ...options, headers });
};

const apiFetch = async (token, endPoint, params = {}, headers = {}, options = {}) => {
	const stringParams = Object.entries(params).map(p => p.join('=')).join('&');
	const url = MENDELEY_API_URL + '/' + endPoint + '?' + stringParams;
	return apiFetchUrl(token, url, headers, options);
};

const get = async (token, endPoint, params = {}, headers = {}, options = {}) => {
	const response = await apiFetch(token, endPoint, params, headers, options);
	return JSON.parse(response.responseText);
};

const getAll = async (token, endPoint, params = {}, headers = {}, options = {}) => {
	const PER_PAGE = endPoint === 'annotations' ? 200 : 500;
	const response = await apiFetch(token, endPoint, { ...params, limit: PER_PAGE }, headers, options);
	var next = getNextLinkFromResponse(response);
	var data = JSON.parse(response.responseText);
	
	while (next) {
		const response = await apiFetchUrl(token, next, headers, options); //eslint-disable-line no-await-in-loop
		data = [...data, ...JSON.parse(response.responseText)];
		next = getNextLinkFromResponse(response);
	}

	return data;
};


return { getNextLinkFromResponse, apiFetch, apiFetchUrl, get, getAll };
})();
