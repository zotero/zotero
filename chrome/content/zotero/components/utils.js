/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

const noop = () => {};

var _htmlId = 1;

const nextHtmlId = (prefix = 'id-') => prefix + _htmlId++;

const scrollIntoViewIfNeeded = (element, container, opts = {}) => {
	const containerTop = container.scrollTop;
	const containerBottom = containerTop + container.clientHeight;
	const elementTop = element.offsetTop;
	const elementBottom = elementTop + element.clientHeight;

	if (elementTop < containerTop || elementBottom > containerBottom) {
		const before = container.scrollTop;
		element.scrollIntoView(opts);
		const after = container.scrollTop;
		return after - before;
	}
	return 0;
};

const getLicenseData = (license) => {
	var name, img, url;

	switch (license) {
		case 'reserved':
			url = null;
			name = 'All rights reserved';
			img = 'chrome://zotero/skin/licenses/reserved.png';
			break;
		case 'cc':
			url = 'https://creativecommons.org/';
			name = Zotero.getString('licenses.' + license) + ' (' + license.toUpperCase() + ')';
			img = 'chrome://zotero/skin/licenses/cc-srr.png';
			break;
		
		case 'cc0':
			url = "https://creativecommons.org/publicdomain/zero/1.0/";
			name = 'CC0 1.0 Universal Public Domain Dedication';
			img = 'chrome://zotero/skin/licenses/' + license + ".svg";
			break;
		
		default:
			url = 'https://creativecommons.org/licenses/' + license.replace(/^cc-/, '') + '/4.0/';
			name = Zotero.getString('licenses.' + license) + ' (' + license.toUpperCase() + ')';
			img = 'chrome://zotero/skin/licenses/' + license + ".svg";
			break;
	}

	return { name, img, url };
};

export {
	getLicenseData,
	nextHtmlId,
	noop,
	scrollIntoViewIfNeeded,
};
