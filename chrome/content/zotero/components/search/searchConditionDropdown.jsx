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

function SearchConditionDropdown({ libraryID, savedSearchID, condition, value, onValueChange }) {
	let rows = [];
	
	if (condition === 'collection' || condition === 'savedSearch') {
		// Add collections
		let cols = Zotero.Collections.getByLibrary(libraryID, true);
		for (let col of cols) {
			// Indent subcollections
			var indent = '';
			if (col.level) {
				for (let j = 1; j < col.level; j++) {
					indent += '    ';
				}
				indent += '- ';
			}
			rows.push({
				name: indent + col.name,
				value: 'C' + col.key,
				image: Zotero.Collection.prototype.treeViewImage
			});
		}
		
		// Add saved searches
		let searches = Zotero.Searches.getByLibrary(libraryID);
		for (let search of searches) {
			// Do not include the current saved search in collection list
			if (search.id != savedSearchID) {
				rows.push({
					name: search.name,
					value: 'S' + search.key,
					image: Zotero.Search.prototype.treeViewImage
				});
			}
		}
	}
	else if (condition === 'itemType') {
		rows = Zotero.ItemTypes.getTypes().map(type => ({
			name: Zotero.ItemTypes.getLocalizedString(type.id),
			value: type.name
		}));
		
		// Sort by localized name
		let collation = Zotero.getLocaleCollation();
		rows.sort((a, b) => collation.compareString(1, a.name, b.name));
	}
	else if (condition === 'fileTypeID') {
		rows = Zotero.FileTypes.getTypes().map(type => ({
			name: Zotero.getString('fileTypes.' + type.name),
			value: type.id
		}));
		
		// Sort by localized name
		let collation = Zotero.getLocaleCollation();
		rows.sort((a, b) => collation.compareString(1, a.name, b.name));
	}

	const handleValueChange = (e) => {
		let value = e.target.value;

		if (condition === 'collection') {
			let letter = value.substr(0, 1);
			if (letter === 'C') {
				condition = 'collection';
			}
			else if (letter === 'S') {
				condition = 'savedSearch';
			}
			value = value.substr(1);
		}

		onValueChange(condition, value);
	};

	return (
		<select
			id="valuemenu"
			className="flex-1"
			value={ value }
			onChange={ handleValueChange }
		>
			{ rows.map((row, index) => {
				return (
					<option
						key={ index }
						value={ row.value }
					>
						{ row.name }
					</option>
				);
			}) }
		</select>
	);
}


SearchConditionDropdown.propTypes = {
	condition: PropTypes.string,
	libraryID: PropTypes.string,
	savedSearchID: PropTypes.string,
	value: PropTypes.string,
	onValueChange: PropTypes.func
};


export default memo(SearchConditionDropdown);
