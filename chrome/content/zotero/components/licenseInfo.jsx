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

const links = {
	cc: 'https://wiki.creativecommons.org/Considerations_for_licensors_and_licensees',
	cc0: 'https://wiki.creativecommons.org/CC0_FAQ'
};

const LicenseInfo = ({ license }) => {
	const { name, img, url } = getLicenseData(license);
	
	const handleUrlClick = useCallback((ev) => {
		Zotero.launchURL(ev.currentTarget.href);
		ev.preventDefault();
	}, []);

	const licenseInfo = (
		<React.Fragment>
			<div>
				<img
					title={ url }
					src={ img }
					className="license-icon"
				></img>
			</div>
			<div>{ name }</div>
		</React.Fragment>
	);

	const needsMoreInfo = license.startsWith('cc') && license !== 'cc';
	const ccType = license === 'cc0' ? 'cc0' : 'cc';
	const moreInfo = Zotero.getString('publications.' + ccType + '.moreInfo.text').split('%S');
		
	return (
		<React.Fragment>
			{ url ? (
				<a className="license-info" href={ url } onClick={ handleUrlClick } >
					{ licenseInfo }
				</a>
			) : (
				<div className="license-info">
					{ licenseInfo }
				</div>
			) }
			{ needsMoreInfo && (
				<div className="license-more-info">
					{ moreInfo[0] }
					<a href={ links[ccType] } onClick={ handleUrlClick } >
						{ Zotero.getString('publications.' + ccType + '.moreInfo.linkText') }
					</a>
					{ moreInfo[1] }
				</div>
			) }
		</React.Fragment>
	);
};


LicenseInfo.propTypes = {
	license: PropTypes.string,
};

export default memo(LicenseInfo);
