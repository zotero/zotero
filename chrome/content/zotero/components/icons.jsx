'use strict';

const React = require('react');
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

// Icons cache for a few remaining png icons till they are replaced
let legacyIconsCache = {};

function i(name, svgOrSrc, hasHiDPI = true) {
	if (typeof svgOrSrc == 'string' && hasHiDPI && window.devicePixelRatio >= 1.25) {
		// N.B. In Electron we can use css-image-set
		let parts = svgOrSrc.split('.');
		parts[parts.length - 2] = parts[parts.length - 2] + '@2x';
		svgOrSrc = parts.join('.');
	}
	legacyIconsCache[`Icon${name}`] = svgOrSrc;
}

/* eslint-disable max-len */

i('Cross', "chrome://zotero/skin/cross.png");
i('Tick', "chrome://zotero/skin/tick.png");
i('ArrowRefresh', "chrome://zotero/skin/arrow_refresh.png");


let cssIconsCache = new Map();

module.exports.getCSSIcon = function (key) {
	if (!cssIconsCache.has(key)) {
		let iconEl = document.createElement('span');
		iconEl.classList.add('icon');
		iconEl.classList.add('icon-css');
		iconEl.classList.add(`icon-${key}`);
		// Temporarily set background image for a few remaining png icons
		if (legacyIconsCache[key]) {
			iconEl.style.backgroundImage = `url(${legacyIconsCache[key]})`;
			iconEl.classList.add("icon-bg");
		}
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
