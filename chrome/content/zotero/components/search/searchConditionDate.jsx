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

'use strict';

import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

function SearchConditionDate({ value, onValueChange }) {
	const intl = useIntl();

	let [num, units] = value.split(' ');

	if (!num) {
		num = '';
	}

	if (!units) {
		units = 'days';
	}

	return (
		<div className="flex-1 flex-row-center">
			<input
				className="flex-1"
				value={ num }
				type="text"
				onChange={ e => onValueChange(e.target.value + ' ' + units) }
			/>
			<select
				id="search-in-the-last"
				className="flex-1"
				value={ units }
				onChange={ e => onValueChange(num + ' ' + e.target.value) }
			>
				<option value="days">
					{ intl.formatMessage({ id: 'zotero.search.date.units.days' }) }
				</option>
				<option value="months">
					{ intl.formatMessage({ id: 'zotero.search.date.units.months' }) }
				</option>
				<option value="years">
					{ intl.formatMessage({ id: 'zotero.search.date.units.years' }) }
				</option>
			</select>
		</div>
	);
}


SearchConditionDate.propTypes = {
	value: PropTypes.string,
	onValueChange: PropTypes.func
};


export default memo(SearchConditionDate);
