import React, { memo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';

function RadioSet({ onChange, options, value }) {
	const id = useRef('zotero-radio-set-' + Zotero.nextHtmlID++);

	const handleChange = useCallback((ev) => {
		if (value !== ev.target.value) {
			onChange(ev.target.value);
		}
	}, [value, onChange]);

	return (
		<fieldset className="form-group radios">
			{ options.map((option, index) => (
				<div key={ option.value } className="radio">
					<input
						id={ id + '-' + index}
						value={ option.value }
						type="radio"
						checked={ option.value === value }
						onChange={ handleChange }
					/>
					<label htmlFor={ id + '-' + index} key={ value }>
						{ option.label }
					</label>
				</div>
			))}
		</fieldset>
	);
}

RadioSet.propTypes = {
	onChange: PropTypes.func.isRequired,
	options: PropTypes.array.isRequired,
	value: PropTypes.string,
};

export default memo(RadioSet);
