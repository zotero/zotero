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

let cssIconsCache = new Map();

module.exports.getCSSIcon = function (key) {
	if (!cssIconsCache.has(key)) {
		if (key.startsWith('annotation-')) {
			// key is annotation-{type}-{color}
			let [annotationType, annotationColor] = key.split('-').slice(1);
			let img = document.createElement("img");
			img.className = "annotation-icon";
			let type = annotationType;
			if (type == 'image') {
				type = 'area';
			}
			img.src = 'chrome://zotero/skin/16/universal/annotate-' + type + '.svg';
			img.style.fill = annotationColor;
			cssIconsCache.set(key, img);
			return img;
		}
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
