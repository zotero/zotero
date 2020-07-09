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
