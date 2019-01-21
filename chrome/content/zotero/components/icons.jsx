'use strict';

const React = require('react')
const { PureComponent } = React
const { element, string } = require('prop-types')
const cx = require('classnames')

const Icon = ({ children, className, name }) => (
	<span className={cx('icon', `icon-${name}`, className)}>
		{children}
	</span>
)

Icon.propTypes = {
	children: element.isRequired,
	className: string,
	name: string.isRequired
}

module.exports = { Icon }


function i(name, svgOrSrc, hasDPI=true) {
	const icon = class extends PureComponent {
		render() {
			const { className } = this.props
			
			if (typeof svgOrSrc == 'string') {
				if (hasDPI && window.devicePixelRatio >= 1.25) {
					let parts = svgOrSrc.split('.');
					parts[parts.length-2] = parts[parts.length-2] + '@2x';
					svgOrSrc = parts.join('.')
				}
				return <Icon className={className} name={name.toLowerCase()}><img src={svgOrSrc}/></Icon>
			}

			return (
				<Icon className={className} name={name.toLowerCase()}>{svgOrImg}</Icon>
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


i('TagSelectorMenu', "chrome://zotero/skin/tag-selector-menu.png")
i('DownChevron', "chrome://zotero/skin/searchbar-dropmarker.png")

