/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
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

'use strict'

const React = require('react')
const { PureComponent, createElement: create } = React
const { CSSIcon } = require('./icons')
const cx = require('classnames')
const {
	bool, element, func, node, number, oneOf, string
} = require('prop-types')


const ButtonGroup = ({ children }) => (
	<div className="btn-group">{children}</div>
)

ButtonGroup.propTypes = {
	children: node
}

class Button extends PureComponent {
	get classes() {
		return ['btn', this.props.className, `btn-${this.props.size}`, {
			'btn-icon': this.props.icon != null,
			'active': this.props.isActive,
			'btn-flat': this.props.isFlat,
			'btn-menu': this.props.isMenu,
			'disabled': this.props.isDisabled,
		}]
	}

	get node() {
		return 'button'
	}

	get text() {
		const { text } = this.props;

		return text ?
			Zotero.getString(text) :
			null;
	}

	get title() {
		const { title } = this.props;

		return title ?
			Zotero.getString(title) :
			null;
	}
	
	get menuMarker() {
		return this.props.isMenu && <CSSIcon name="chevron-6" className="menu-marker icon-8"/>
	}

	get attributes() {
		const attr = {
			className: cx(...this.classes),
			disabled: !this.props.noFocus && this.props.isDisabled,
			onBlur: this.handleBlur,
			onFocus: this.props.onFocus,
			ref: this.setContainer,
			title: this.title
		}

		if (!this.props.isDisabled) {
			attr.onMouseDown = (event) => {
				return this.handleMouseDown(event);
			};
			attr.onClick = this.handleClick
		}

		return attr
	}

	setContainer = (container) => {
		this.container = container
	}

	handleClick = (event) => {
		event.preventDefault()

		if (!this.props.isDisabled && this.props.onClick) {
			this.props.onClick(event)
		}
	}

	handleMouseDown = (event) => {
		event.preventDefault()

		if (!this.props.isDisabled && this.props.onMouseDown) {
			this.props.onMouseDown(event)
		}
	}

	render() {
		return create(this.node, this.attributes, this.props.icon, this.text, this.menuMarker)
	}

	static propTypes = {
		className: string,
		icon: element,
		isActive: bool,
		isDisabled: bool,
		isMenu: bool,
		size: oneOf(['sm', 'md', 'lg']),
		title: string,
		text: string,
		onClick: func,
		onMouseDown: func
	}
	
	static defaultProps = {
		size: 'md'
	}
}


module.exports = {
	ButtonGroup,
	Button
}
