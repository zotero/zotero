/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2021 Corporation for Digital Scholarship
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
import cx from 'classnames';

function ProgressBar({ indeterminate = false, max = 100, value, className }) {
	return indeterminate
		? <progress className={ cx('progress-bar', className) } max={ max } />
		: <progress className={ cx('progress-bar', className) } value={ value } max={ max } />;
}

ProgressBar.propTypes = {
	className: PropTypes.string,
	indeterminate: PropTypes.bool,
	max: PropTypes.number,
	value: PropTypes.number,
};

export default memo(ProgressBar);
