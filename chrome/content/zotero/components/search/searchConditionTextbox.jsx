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
import Input from "../form/input";
import { Cc, Ci } from 'chrome';

var search = Cc["@mozilla.org/autocomplete/search;1?name=zotero"]
	.createInstance(Ci.nsIAutoCompleteSearch);

function SearchConditionTextbox({ condition, onModeChange, onValueChange }) {
	const intl = useIntl();

	const handleValueChange = (value) => {
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

	const getSuggestions = async (value) => {
		let i = 0;

		return new Zotero.Promise(function (resolve, reject) {
			let results = [];

			let params = {
				fieldName: condition.condition
			};
			if (condition.condition === 'creator') {
				params.fieldMode = 2;
			}

			search.startSearch(
				value,
				JSON.stringify(params),
				[],
				{
					onSearchResult: function (search, result) {
						if (result.searchResult == result.RESULT_IGNORED
							|| result.searchResult == result.RESULT_FAILURE) {
							reject(result.errorDescription);
							return;
						}
						if (result.searchResult == result.RESULT_SUCCESS
							|| result.searchResult == result.RESULT_SUCCESS_ONGOING) {
							// Pick up where we left off
							for (; i < result.matchCount; i++) {
								results.push(result.getValueAt(i));
							}
						}
						if (result.searchResult != result.RESULT_SUCCESS_ONGOING
							&& result.searchResult != result.RESULT_NOMATCH_ONGOING) {
							resolve(results);
						}
					}
				}
			);
		});
	};

	const useAutoComplete = !['date', 'note', 'extra'].includes(condition.condition);

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
			<Input
				autoComplete={ useAutoComplete }
				autoFocus
				className="flex-1"
				inputGroupClassName="flex-1"
				getSuggestions={ getSuggestions }
				onChange={ handleValueChange }
				value={ condition.value }
				alwaysRenderSuggestions={ true }
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
