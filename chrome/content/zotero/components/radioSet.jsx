/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
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
import React, { memo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { nextHtmlId } from './utils';

function RadioSet({ className, onChange, options, value }) {
	const id = useRef(nextHtmlId());

	const handleChange = useCallback((ev) => {
		if (value !== ev.target.value) {
			onChange(ev.target.value);
		}
	}, [value, onChange]);

	return (
		<fieldset className={ cx('form-group radioset', className) }>
			{ options.map((option, index) => (
				<div key={ option.value } className="radio">
					<input
						id={ id.current + '-' + index}
						value={ option.value }
						type="radio"
						checked={ option.value === value }
						onChange={ handleChange }
					/>
					<label htmlFor={ id.current + '-' + index} key={ value }>
						{ option.label }
					</label>
				</div>
			))}
		</fieldset>
	);
}

RadioSet.propTypes = {
	className: PropTypes.string,
	onChange: PropTypes.func.isRequired,
	options: PropTypes.array.isRequired,
	value: PropTypes.string,
};

export default memo(RadioSet);
