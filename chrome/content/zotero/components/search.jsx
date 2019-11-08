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
