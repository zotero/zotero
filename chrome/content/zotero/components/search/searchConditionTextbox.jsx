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

function SearchConditionTextbox({ condition, onModeChange, onValueChange }) {
	const intl = useIntl();

	const handleValueChange = (e) => {
		let value = e.target.value;

		// Convert datetimes to UTC before saving
		switch (condition.condition) {
			case 'accessDate':
			case 'dateAdded':
			case 'dateModified':
				if (Zotero.Date.isSQLDateTime(value)) {
					value = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(value), true);
				}
		}

		onValueChange(value);
	};

	// Convert datetimes from UTC to localtime
	if ((condition.condition === 'accessDate'
			|| condition.condition === 'dateAdded'
			|| condition.condition === 'dateModified')
			&& Zotero.Date.isSQLDateTime(condition.value)) {
		condition.value = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(condition.value, true));
	}

	return (
		<div className="flex-1 flex-row-center">
			{ condition.condition === 'fulltextContent'
				? <select
					id="modemenu"
					className="flex-1"
					value={ condition.mode }
					onChange={ onModeChange }
				>
					<option value="phrase">
						{ intl.formatMessage({ id: 'zotero.search.textModes.phrase' }) }
					</option>
					<option value="phraseBinary">
						{ intl.formatMessage({ id: 'zotero.search.textModes.phraseBinary' }) }
					</option>
					<option value="regexp">
						{ intl.formatMessage({ id: 'zotero.search.textModes.regexp' }) }
					</option>
					<option value="regexpCS">
						{ intl.formatMessage({ id: 'zotero.search.textModes.regexpCS' }) }
					</option>
				</select>
				: ''
			}
			<input
				className="flex-1"
				type="text"
				value={ condition.value }
				onChange={ handleValueChange }
			/>
		</div>
	);
}


SearchConditionTextbox.propTypes = {
	condition: PropTypes.object,
	onModeChange: PropTypes.func,
	onValueChange: PropTypes.func
};


export default memo(SearchConditionTextbox);
