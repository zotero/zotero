import React, { memo } from 'react';
import PropTypes from 'prop-types';

function WizardPage({ children, label }) {
	return (
		<div className="wizard-page">
			<h1 className="wizard-header-label">
				{ label }
			</h1>
			{ children }
		</div>
	);
}

WizardPage.propTypes = {
	children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),
	label: PropTypes.string,
	onPageAdvance: PropTypes.func,
	onPageRewound: PropTypes.func,
	onPageShow: PropTypes.func,
};

export default memo(WizardPage);
