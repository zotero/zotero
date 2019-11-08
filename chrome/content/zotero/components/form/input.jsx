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

import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { noop } from '../utils';
import { pickKeys } from '@zotero/immutable';
//import AutoResizer from './auto-resizer';
import Autosuggest from 'react-autosuggest';

class Input extends React.PureComponent {
	constructor(props) {
		super(props);
		this.state = {
			suggestions: [],
			value: props.value
		};
		this.suggestions = React.createRef();
		this.showSuggestions = React.createRef(false);
		this.preSuggestionValue = React.createRef();
		this.selectedSuggestion = React.createRef();
	}

	cancel(event = null) {
		this.props.onCancel(this.hasChanged, event);
		this.hasBeenCancelled = true;
		this.props.innerRef.current && this.props.innerRef.current.blur();
	}

	commit(event = null) {
		this.props.onCommit(this.state.value, this.hasChanged, event);
		this.hasBeenCommitted = true;
	}

	focus() {
		if (this.props.innerRef.current != null) {
			this.props.innerRef.current.focus();
			this.props.selectOnFocus && this.props.innerRef.current.select();
		}
	}

	UNSAFE_componentWillReceiveProps({ value }) {
		if (value !== this.props.value) {
			this.setState({ value });
		}
	}

	handleChange({ target }, options) {
		var newValue = options.newValue || target.value;
		this.setState({
			value: newValue,
		});
		this.props.onChange(newValue);
	}

	handleBlur(event) {
		if (this.selectedSuggestion.current) {
			this.selectedSuggestion.current = null;
			return;
		}
		if (this.hasBeenCancelled || this.hasBeenCommitted) { return; }
		const shouldCancel = this.props.onBlur(event);
		shouldCancel ? this.cancel(event) : this.commit(event);
	}

	handleFocus(event) {
		!this.focused && this.props.selectOnFocus && event.target.select();
		// Only focus the input once so that the entered text doesn't get selected when it matches
		// a suggestion and the input gets rerendered with the suggestions drop-down
		this.focused = true;
		this.showSuggestions.current = false;
		this.props.onFocus(event);
	}

	handleKeyDown(event) {
		this.showSuggestions.current = true;
		switch (event.key) {
			case 'Escape':
				this.cancel(event);
			break;
			
			case 'Enter':
				if (this.selectedSuggestion.current) {
					let value = this.selectedSuggestion.current;
					this.selectedSuggestion.current = null;
					this.setState({ value });
				}
				else {
					this.commit(event);
				}
			break;
		}
		this.props.onKeyDown(event);
	}

	handlePaste(event) {
		this.props.onPaste && this.props.onPaste(event);
	}

	// Autosuggest will call this function every time you need to update suggestions.
	// You already implemented this logic above, so just use it.
	async handleSuggestionsFetchRequested({ value }) {
		this.setState({
			suggestions: await this.props.getSuggestions(value)
		});
	}
	
	// Autosuggest will call this function every time you need to clear suggestions.
	handleSuggestionsClearRequested() {
		this.setState({
			suggestions: []
		});
	}
	
	getSuggestionValue(suggestion) {
		return suggestion;
	}
	
	shouldRenderSuggestions(value) {
		return value.length && this.showSuggestions.current;
	}
	
	renderSuggestion(suggestion) {
		return <span>
			{suggestion}
		</span>;
	}
	
	handleSuggestionSelected = (event, { suggestion, suggestionValue, suggestionIndex, sectionIndex, method }) => {
		this.selectedSuggestion.current = suggestionValue;
		// focusInputOnSuggestionClick in Autosuggest doesn't work with a custom renderInputComponent,
		// so refocus the textbox manually
		setTimeout(() => this.props.innerRef.current.focus());
	}

	get value() {
		return this.state.value;
	}

	get hasChanged() {
		return this.state.value !== this.props.value;
	}

	renderInput() {
		this.hasBeenCancelled = false;
		this.hasBeenCommitted = false;
		
		const inputProps = {
			disabled: this.props.isDisabled,
			onBlur: this.handleBlur.bind(this),
			onChange: this.handleChange.bind(this),
			onFocus: this.handleFocus.bind(this),
			onKeyDown: this.handleKeyDown.bind(this),
			onPaste: this.handlePaste.bind(this),
			readOnly: this.props.isReadOnly,
			required: this.props.isRequired,
			value: this.state.value,
			...pickKeys(this.props, ['autoFocus', 'className', 'form', 'id', 'inputMode', 'max',
				'maxLength', 'min', 'minLength', 'name', 'placeholder', 'type', 'spellCheck',
				'step', 'tabIndex']),
			...pickKeys(this.props, key => key.match(/^(aria-|data-).*/))
		};
		
		var input = this.props.autoComplete ? (
			<Autosuggest
				suggestions={this.state.suggestions}
				onSuggestionsFetchRequested={this.handleSuggestionsFetchRequested.bind(this)}
				onSuggestionsClearRequested={this.handleSuggestionsClearRequested.bind(this)}
				onSuggestionSelected={this.handleSuggestionSelected}
				getSuggestionValue={this.getSuggestionValue.bind(this)}
				renderSuggestion={this.renderSuggestion.bind(this)}
				// https://github.com/moroshko/react-autosuggest/issues/474
				renderInputComponent={(inputProps) => <input {...inputProps} ref={this.props.innerRef} />}
				focusInputOnSuggestionClick={false}
				shouldRenderSuggestions={this.shouldRenderSuggestions.bind(this)}
				inputProps={inputProps}
			/>
		) : (
			<input { ...inputProps } />
		);

		if(this.props.resize) {
			/*input = (
				<AutoResizer
					content={ this.state.value }
					vertical={ this.props.resize === 'vertical' }
				>
					{ input }
				</AutoResizer>
			);*/
		}

		return input;
	}

	render() {
		const className = cx({
			'input-group': true,
			'input': true,
			'busy': this.props.isBusy
		}, this.props.inputGroupClassName);
		return (
			<div className={ className }>
				{ this.renderInput() }
			</div>
		);
	}

	static defaultProps = {
		className: 'form-control',
		onBlur: noop,
		onCancel: noop,
		onChange: noop,
		onCommit: noop,
		onFocus: noop,
		onKeyDown: noop,
		onPaste: noop,
		tabIndex: -1,
		type: 'text',
		value: '',
	};

	static propTypes = {
		autoComplete: PropTypes.bool,
		autoFocus: PropTypes.bool,
		className: PropTypes.string,
		form: PropTypes.string,
		getSuggestions: PropTypes.func,
		id: PropTypes.string,
		inputGroupClassName: PropTypes.string,
		inputMode: PropTypes.string,
		isBusy: PropTypes.bool,
		isDisabled: PropTypes.bool,
		isReadOnly: PropTypes.bool,
		isRequired: PropTypes.bool,
		max: PropTypes.number,
		maxLength: PropTypes.number,
		min: PropTypes.number,
		minLength: PropTypes.number,
		name: PropTypes.string,
		onBlur: PropTypes.func.isRequired,
		onCancel: PropTypes.func.isRequired,
		onChange: PropTypes.func.isRequired,
		onCommit: PropTypes.func.isRequired,
		onFocus: PropTypes.func.isRequired,
		onKeyDown: PropTypes.func,
		onPaste: PropTypes.func,
		placeholder: PropTypes.string,
		resize: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
		selectOnFocus: PropTypes.bool,
		spellCheck: PropTypes.bool,
		step: PropTypes.number,
		tabIndex: PropTypes.number,
		type: PropTypes.string.isRequired,
		value: PropTypes.string.isRequired,
	};
}

export default React.forwardRef((props, ref) => <Input
	innerRef={ref} {...props}
/>);