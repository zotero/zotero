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
//import Spinner from '../ui/spinner';
import Select from 'react-select';

class SelectInput extends React.PureComponent {
	constructor(props) {
		super(props);
		this.state = {
			value: props.value
		};
	}

	cancel(event = null) {
		this.props.onCancel(this.hasChanged, event);
	}

	commit(event = null, value = null, force = false) {
		this.props.onCommit(value || this.state.value, force ? true : this.hasChanged, event);
	}

	focus() {
		if(this.input != null) {
			this.input.focus();
		}
	}

	UNSAFE_componentWillReceiveProps({ value }) {
		if (value !== this.props.value) {
			this.setState({ value });
		}
	}

	handleChange(value, ev) {
		value = value !== null || (value === null && this.props.clearable) ?
			value : this.props.value;
		this.setState({ value });

		if(this.props.onChange(value) || this.forceCommitOnNextChange) {
			if(!ev) {
				//@NOTE: this is using undocumeneted feature of react-selct v1, but see #131
				const source = typeof this.input.input.getInput === 'function' ?
					this.input.input.getInput() : this.input.input;
				ev = {
					type: 'change',
					currentTarget: source,
					target: source
				}
			}
			this.commit(ev, value, value !== this.props.value);
		}
		this.forceCommitOnNextChange = false;
	}

	handleBlur(event) {
		this.props.onBlur(event);
		this.cancel(event);
		if(this.props.autoBlur) {
			this.forceCommitOnNextChange = true;
		}
	}

	handleFocus(event) {
		this.props.onFocus(event);
	}

	handleKeyDown(event) {
		switch (event.key) {
			case 'Escape':
				this.cancel(event);
			break;
		default:
			return;
		}
	}

	get hasChanged() {
		return this.state.value !== this.props.value;
	}

	get defaultSelectProps() {
		return {
			simpleValue: true,
			clearable: false,
		};
	}

	renderInput(userType, viewport) {
		const {
			options,
			autoFocus,
			className,
			id,
			placeholder,
			tabIndex,
			value,
		} = this.props;

		const commonProps = {
			disabled: this.props.isDisabled,
			onBlur: this.handleBlur.bind(this),
			onFocus: this.handleFocus.bind(this),
			readOnly: this.props.isReadOnly,
			ref: input => this.input = input,
			required: this.props.isRequired,
		};

		if(userType === 'touch' || viewport.xxs || viewport.xs || viewport.sm) {
			const props = {
				...commonProps,
				onKeyDown: this.handleKeyDown.bind(this),
				onChange: ev => this.handleChange(ev.target.value, ev),
				autoFocus, id, placeholder, tabIndex, value
			};
			return (
				<div className="native-select-wrap" >
					<select { ...props }>
						{ options.map(({ value, label }) => (
							<option key={ value } value={ value }>{ label }</option>)
						)}
					</select>
					<div className={ className }>
						{ (options.find(o => o.value === value) || options[0] || {}).label }
					</div>
				</div>

			);
		} else {
			const props = {
				...this.defaultSelectProps,
				...this.props,
				...commonProps,
				onInputKeyDown: this.handleKeyDown.bind(this),
				onChange: this.handleChange.bind(this),
			};

			return <Select { ...props } />;
		}
	}

	renderSpinner() {
		return null;
		//return this.props.isBusy ? <Spinner className="small" /> : null;
	}

	render() {
		const { userType, viewport } = this.props.device;
		const className = cx({
			'input-group': true,
			'select': true,
			'busy': this.props.isBusy
		}, this.props.inputGroupClassName);
		return (
			<div className={ className }>
				{ this.renderInput(userType, viewport) }
				{ this.renderSpinner() }
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
		options: [],
		tabIndex: -1,
		value: '',
	};

	static propTypes = {
		autoFocus: PropTypes.bool,
		className: PropTypes.string,
		id: PropTypes.string,
		inputGroupClassName: PropTypes.string,
		isBusy: PropTypes.bool,
		isDisabled: PropTypes.bool,
		isReadOnly: PropTypes.bool,
		isRequired: PropTypes.bool,
		onBlur: PropTypes.func.isRequired,
		onCancel: PropTypes.func.isRequired,
		onChange: PropTypes.func.isRequired,
		onCommit: PropTypes.func.isRequired,
		onFocus: PropTypes.func.isRequired,
		options: PropTypes.array.isRequired,
		placeholder: PropTypes.string,
		tabIndex: PropTypes.number,
		value: PropTypes.string.isRequired,
	};
}

export default SelectInput;
