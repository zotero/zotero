'use strict';

const React = require('react');
const { renderToStaticMarkup } = require('react-dom-server');
const { PureComponent } = React;
const { element, string, object } = require('prop-types');

const Icon = (props) => {
	props = Object.assign({}, props);
	props.className = `icon icon-${props.name} ${props.className || ""}`;
	delete props.name;
	// Pass the props forward
	return <span {...props}></span>;
};

Icon.propTypes = {
	children: element,
	className: string,
	name: string.isRequired,
	style: object
}

const CSSIcon = (props) => {
	props = Object.assign({}, props);
	props.className = `icon icon-css icon-${props.name} ${props.className || ""}`;
	delete props.name;
	// Pass the props forward
	return <span {...props}></span>;
};

CSSIcon.propTypes = {
	children: element,
	className: string,
	name: string.isRequired,
	style: object
};

const CSSItemTypeIcon = (props) => {
	props = Object.assign({}, props);
	let itemType = props.itemType;
	delete props.itemType;
	return <CSSIcon name="item-type" data-item-type={itemType} {...props} />;
};

CSSItemTypeIcon.propTypes = {
	children: element,
	className: string,
	itemType: string.isRequired,
	style: object
};

module.exports = { Icon, CSSIcon, CSSItemTypeIcon };


function i(name, svgOrSrc, hasHiDPI = true) {
	if (typeof svgOrSrc == 'string' && hasHiDPI && window.devicePixelRatio >= 1.25) {
		// N.B. In Electron we can use css-image-set
		let parts = svgOrSrc.split('.');
		parts[parts.length - 2] = parts[parts.length - 2] + '@2x';
		svgOrSrc = parts.join('.');
	}

	const icon = class extends PureComponent {
		render() {
			let props = Object.assign({}, this.props);
			props.name = name.toLowerCase();
			
			if (typeof svgOrSrc == 'string') {
				if (!("style" in props)) props.style = {};
				props.style.backgroundImage = `url(${svgOrSrc})`;
				props.className = props.className || "";
				props.className += " icon-bg";
				// We use css background-image.
				// This is a performance optimization for fast-scrolling trees.
				// If we use img elements they are slow to render
				// and produce pop-in when fast-scrolling.
				return (
					<Icon {...props} />
				);
			}

			return (
				<Icon {...props}>{svgOrSrc}</Icon>
			)
		}
	}

	icon.propTypes = {
		className: string
	}

	icon.displayName = `Icon${name}`

	module.exports[icon.displayName] = icon
}

/* eslint-disable max-len */


i('Twisty', (
	/* This Source Code Form is subject to the terms of the Mozilla Public
	 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
	 * You can obtain one at http://mozilla.org/MPL/2.0/. */
	<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
		<path d="M8 13.4c-.5 0-.9-.2-1.2-.6L.4 5.2C0 4.7-.1 4.3.2 3.7S1 3 1.6 3h12.8c.6 0 1.2.1 1.4.7.3.6.2 1.1-.2 1.6l-6.4 7.6c-.3.4-.7.5-1.2.5z"/>
	</svg>
));
i('Cross', "chrome://zotero/skin/cross.png");
i('Tick', "chrome://zotero/skin/tick.png");
i('ArrowRefresh', "chrome://zotero/skin/arrow_refresh.png");

if (Zotero.isMac) {
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
			<polyline points="3 4 12 4 7.5 12"/>
		</svg>
	));
}

if (Zotero.isWin) {
	i('Twisty', (
		/* This Source Code Form is subject to the terms of the Mozilla Public
		 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
		 * You can obtain one at http://mozilla.org/MPL/2.0/. */
		<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1792 1792">
			<path d="M1395 736q0 13-10 23l-466 466q-10 10-23 10t-23-10l-466-466q-10-10-10-23t10-23l50-50q10-10 23-10t23 10l393 393 393-393q10-10 23-10t23 10l50 50q10 10 10 23z"/>
		</svg>
	));
}

let domElementCache = {};

/**
 * Returns a DOM element for the icon class
 *
 * To be used in itemTree where rendering is done without react
 * for performance reasons
 * @param {String} icon
 * @returns {Element}
 */
module.exports.getDOMElement = function (icon) {
	if (domElementCache[icon]) return domElementCache[icon].cloneNode(true);
	if (!module.exports[icon]) {
		Zotero.debug(`Attempting to get non-existant icon ${icon}`);
		return "";
	}
	let div = document.createElement('div');
	div.innerHTML = renderToStaticMarkup(React.createElement(module.exports[icon]));
	domElementCache[icon] = div.firstChild;
	return domElementCache[icon].cloneNode(true);
};

let cssIconsCache = new Map();

module.exports.getCSSIcon = function (key) {
	if (!cssIconsCache.has(key)) {
		let iconEl = document.createElement('span');
		iconEl.classList.add('icon');
		iconEl.classList.add('icon-css');
		iconEl.classList.add(`icon-${key}`);
		cssIconsCache.set(key, iconEl);
	}

	return cssIconsCache.get(key).cloneNode(true);
};

module.exports.getCSSItemTypeIcon = function (itemType, key = 'item-type') {
	let icon = module.exports.getCSSIcon(key);
	icon.dataset.itemType = itemType;
	return icon;
};

module.exports['IconAttachSmall'] = props => <CSSIcon name="attachment" className="icon-16" {...props} />;
module.exports['IconTreeitemNoteSmall'] = props => <CSSIcon name="note" className="icon-16" {...props} />;
