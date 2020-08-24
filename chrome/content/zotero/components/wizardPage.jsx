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
import React, { memo } from 'react';
import PropTypes from 'prop-types';

function WizardPage({ children, label }) {
	return (
		<div className="wizard-page">
			{ (label && typeof label === 'string' && label.length > 0) && (
				<div className="wizard-header">
					<h1 className="wizard-header-label">
						{ label }
					</h1>
				</div>
			) }
			<div className="wizard-body">
				{ children }
			</div>
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
