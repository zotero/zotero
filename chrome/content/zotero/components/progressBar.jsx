import React, { memo } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

function ProgressBar({ value, className }) {
	return (
		<div className={ cx('progress-bar', className) }>
			<div className="progress-bar-value" style={ { width: `${value}%` } }></div>
		</div>
	);
}

ProgressBar.propTypes = {
	className: PropTypes.string,
	value: PropTypes.string.isRequired,
};

export default memo(ProgressBar);
