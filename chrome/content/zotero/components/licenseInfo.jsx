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

import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getLicenseData } from './utils';

const LicenseInfo = ({ license }) => {
	const { name, img, url } = getLicenseData(license);
	const handleUrlClick = useCallback((ev) => {
		Zotero.launchURL(ev.currentTarget.href);
		ev.preventDefault();
	}, []);

	const licenseInfo = (
		<React.Fragment>
			<img
				title={ url }
				src={ img }
				className="license-icon"
			></img>
			{ name }
		</React.Fragment>
	);

	return (
		<div className="license-info">
			{ url ? <a href={ url } onClick={ handleUrlClick } >{ licenseInfo }</a> : licenseInfo }
		</div>
	);
};


LicenseInfo.propTypes = {
	license: PropTypes.string,
};

export default memo(LicenseInfo);
