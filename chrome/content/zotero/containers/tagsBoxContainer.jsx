/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
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

import React, { useState, useEffect } from 'react';
//import PropTypes from 'prop-types';
import { Cc, Ci } from 'chrome';
import TagsBox from 'components/itemPane/tagsBox.js';

var search = Cc["@mozilla.org/autocomplete/search;1?name=zotero"]
	.createInstance(Ci.nsIAutoCompleteSearch);

function TagsBoxContainer(props, ref) {
	var map = Zotero.Tags.getColors(props.item.libraryID);
	const [tags, setTags] = useState(props.item.getTags());
	const [colors, setColors] = useState(Zotero.Tags.getColors(props.item.libraryID));
	
	useEffect(() => {
		var observer = {
			notify: async function (action, type, ids, extraData) {
				if (type == 'setting') {
					if (ids.some(val => val.split("/")[1] == 'tagColors')) {
						setColors(Zotero.Tags.getColors(props.item.libraryID));
					}
				}
				else if (type == 'item-tag') {
					for (let i = 0; i < ids.length; i++) {
						let [itemID, _tagID] = ids[i].split('-').map(x => parseInt(x));
						if (itemID == props.item.id) {
							setTags(props.item.getTags());
							break;
						}
					}
				}
			}
		};
		
		var id = Zotero.Notifier.registerObserver(observer, ['item-tag', 'setting'], 'tagsBox');
		
		return function cleanup() {
			Zotero.Notifier.unregisterObserver(id);
		};
	});
	
	async function getSuggestions(value) {
		return new Zotero.Promise(function (resolve, reject) {
			var results = [];
			search.startSearch(
				value,
				JSON.stringify({
					libraryID: props.item.libraryID,
					fieldName: 'tag',
					itemID: props.item.id
				}),
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
							for (let i = 0; i < result.matchCount; i++) {
								results.push(result.getValueAt(i));
							}
						}
						if (result.searchResult != result.RESULT_SUCCESS_ONGOING &&
								result.searchResult != result.RESULT_NOMATCH_ONGOING) {
							resolve(results);
						}
					}
				}
			);
		});
	}
	
	function handleResetSelection() {
		if (props.onResetSelection) {
			props.onResetSelection();
		}
	}
	
	async function handleTagsUpdate(newTags) {
		var item = props.item;
		item.setTags(newTags);
		await item.saveTx();
	}
	
	return <TagsBox
		colors={colors}
		editable={props.editable}
		getSuggestions={getSuggestions}
		initialTags={tags}
		onResetSelection={handleResetSelection}
		onTagsUpdate={handleTagsUpdate}
		ref={ref}
	/>;
}

export default React.forwardRef(TagsBoxContainer);
