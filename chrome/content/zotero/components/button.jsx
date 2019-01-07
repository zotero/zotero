'use strict'

const React = require('react')
const { PureComponent, createElement: create } = React
const { injectIntl, intlShape } = require('react-intl')
const { IconDownChevron } = require('./icons')
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
	componentDidMount() {
		if (!Zotero.isNode && this.title) {
			// Workaround for XUL tooltips
			this.container.setAttribute('tooltiptext', this.title);
		}
	}

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
		const { intl, text } = this.props

		return text ?
			intl.formatMessage({ id: text }) :
			null
	}

	get title() {
		const { intl, title } = this.props

		return title ?
			intl.formatMessage({ id: title }) :
			null
	}
	
	get menuMarker() {
		if (!Zotero.isNode && Zotero.isLinux) {
			return this.props.isMenu && <span className="menu-marker"/>
		}
		return this.props.isMenu && <IconDownChevron className="menu-marker"/>
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
			attr.onMouseDown = this.handleMouseDown
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
		intl: intlShape.isRequired,
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
	Button: injectIntl(Button)
}
