'use strict';

const React = require('react');
const PropTypes = require('prop-types');

class Search extends React.PureComponent {
	constructor(props) {
		super(props);
		this.inputRef = React.createRef();
	}
	
	state = {
		immediateValue: this.props.value
	};
	
	static getDerivedStateFromProps(props, state) {
		var prevProps = state.prevProps || {};
		return {
			prevProps: props,
			immediateValue: prevProps.value !== props.value
				? props.value
				: state.immediateValue
		};
	}
	
	handleChange = (event) => {
		var value = event.target.value;
		// Update controlled value and cancel button immediately
		this.setState({
			immediateValue: value
		});
		// Debounce the search based on the timeout
		if (this._timeout) {
			clearTimeout(this._timeout);
		}
		this._timeout = this.props.timeout
			&& setTimeout(() => this.props.onSearch(value), this.props.timeout);
	}
	
	handleClear = () => {
		if (this._timeout) {
			clearTimeout(this._timeout);
		}
		this.setState({
			immediateValue: ''
		});
		this.props.onSearch('');
	}
	
	handleKeyDown = (event) => {
		if (event.key == 'Escape') {
			this.handleClear();
		}
	}
	
	focus() {
		this.inputRef.current.focus();
	}
	
	render() {
		return (
			<div className="search">
				<input
					ref={this.inputRef}
					type="search"
					onChange={this.handleChange}
					onKeyDown={this.handleKeyDown}
					value={this.state.immediateValue}
				/>
				{this.state.immediateValue !== ''
					? <div
						className="search-cancel-button"
						onClick={this.handleClear}/>
					: ''}
			</div>
		);
	}

	static propTypes = {
		inputRef: PropTypes.object,
		onSearch: PropTypes.func,
		timeout: PropTypes.number,
		value: PropTypes.string,
	};

	static defaultProps = {
		onSearch: () => {},
		timeout: 300,
		value: '',
	};
}

module.exports = Search;
