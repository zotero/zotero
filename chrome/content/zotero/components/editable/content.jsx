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
import TextAreaInput from '../form/textArea';
import Select from '../form/select';

class EditableContent extends React.PureComponent {
	get hasValue() {
		const { input, value } = this.props;
		return !!(value || input && input.props.value);
	}

	get isSelect() {
		const { input, inputComponent } = this.props;
		return inputComponent === Select || input && input.type == Select;
	}

	get isTextarea() {
		const { input, inputComponent } = this.props;
		return inputComponent === TextAreaInput || input && input.type === TextAreaInput;
	}

	get displayValue() {
		const { options, display, input } = this.props;
		const value = this.props.value || input && input.props.value;
		const placeholder = this.props.placeholder || input && input.props.placeholder;

		if(!this.hasValue) { return placeholder; }
		if(display) { return display; }

		if(this.isSelect && options) {
			const displayValue = options.find(e => e.value == value);
			return displayValue ? displayValue.label : value;
		}

		return value;
	}

	render() {
		const className = {
			'editable-content': true,
			'placeholder': !this.hasValue
		};

		return <div className={ cx(this.props.className, className) }>{ this.displayValue }</div>;
	}

	static defaultProps = {
		value: '',
		placeholder: ''
	};

	static propTypes = {
		display: PropTypes.string,
		input: PropTypes.element,
		inputComponent: PropTypes.elementType,
		options: PropTypes.array,
		placeholder: PropTypes.string,
		value: PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.number
		])
	};
}

export default EditableContent;
