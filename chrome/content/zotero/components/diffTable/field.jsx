/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import Diff from 'diff';

const diffInstance = new Diff();

const MAX_DIFF_SEGMENT_LENGTH = 60;

const Field = (props) => {
	const { itemID, field, readonly, onSetDisabled, onExpand } = props;
	const { fieldName, fieldLabel, oldLabel, newLabel, isDisabled, canAbbreviate = true } = field;

	function cut(str, index) {
		if (index < 0) {
			return 0;
		}

		let cutIndex = null;

		let idx = -1;
		while ((idx = str.indexOf(' ', idx + 1)) >= 0) {
			if (Math.abs(index - idx) < Math.abs(cutIndex - idx)) {
				cutIndex = idx;
			}
		}

		if (!cutIndex || Math.abs(index - cutIndex) > 15) {
			return index;
		}

		return cutIndex;
	}

	function shrink(str, pos) {
		let ellipsis = Zotero.getString('punctuation.ellipsis');
		if (pos === 'start' && str.length > MAX_DIFF_SEGMENT_LENGTH / 2) {
			return ellipsis
				+ str.slice(cut(str, str.length - MAX_DIFF_SEGMENT_LENGTH / 2 - 1)).replace(/^\s+/, '');
		}
		else if (pos === 'middle' && str.length > MAX_DIFF_SEGMENT_LENGTH) {
			return str.slice(0, cut(str, MAX_DIFF_SEGMENT_LENGTH / 2 - 1))
				+ ellipsis
				+ str.slice(cut(str, str.length - MAX_DIFF_SEGMENT_LENGTH / 2 - 1));
		}
		else if (pos === 'end' && str.length > MAX_DIFF_SEGMENT_LENGTH / 2) {
			return str.slice(0, cut(str, MAX_DIFF_SEGMENT_LENGTH / 2 - 1))
				+ ellipsis;
		}
		else if (pos === 'single' && str.length > MAX_DIFF_SEGMENT_LENGTH) {
			return str.slice(0, cut(str, MAX_DIFF_SEGMENT_LENGTH - 1))
				+ ellipsis;
		}

		return str;
	}

	function handleClick(event) {
		onExpand(itemID, fieldName);
		event.preventDefault();
	}

	function handleCheckboxChange(event) {
		onSetDisabled(itemID, fieldName, !event.target.checked);
	}

	function getDiff(oldValue, newValue, canAbbreviate) {
		// As described in https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs#word-mode
		var a = diffInstance.diff_wordsToChars_(oldValue, newValue, [' ', ',']);
		var wordText1 = a.chars1;
		var wordText2 = a.chars2;
		var wordArray = a.wordArray;
		var diffs = diffInstance.diff_main(wordText1, wordText2, false);
		// We're really converting back to words, not lines, but diff_charsToLines_ does the trick
		diffInstance.diff_charsToLines_(diffs, wordArray);
		diffInstance.diff_cleanupSemantic(diffs);

		if (!diffs) return [];

		// Common characters number
		let commonNum = diffs.reduce((acc, value) => acc + (value[0] === 0 ? value[1].length : 0), 0);
		// Changed characters number
		let changedNum = diffs.reduce((acc, value) => acc + (value[0] !== 0 ? value[1].length : 0), 0);

		// Return removed and added content in separate lines
		// if there are common characters and the changed to common ratio is 3:1 (TODO: tweak it)
		if (commonNum > 0 && changedNum / commonNum > 3
			// or if there are only two diffs where one completely removes
			// content and another adds, and the total length of removed and
			// added content is > 60
			|| (diffs.length === 2
				&& diffs[0][0] === -1
				&& diffs[1][0] === 1
				&& diffs[0][1].length + diffs[1][1].length > 60
			)) {
			return [
				<span key={0} className="removed">{canAbbreviate ? shrink(oldLabel, 'single') : oldLabel}</span>,
				<br key={1}/>,
				<span key={2} className="added">{canAbbreviate ? shrink(newLabel, 'single') : newLabel}</span>
			];
		}

		// Otherwise return many fragments of common, removed or added content
		return diffs.map((part, index) => {
			let className = part[0] === 1 ? 'added' : part[0] === -1 ? 'removed' : '';
			let value = part[1];
			value = canAbbreviate
				? shrink(value, diffs.length === 1 && 'single' || index === 0 && 'start' || index === diffs.length - 1 && 'end' || 'middle')
				: value;
			return <span key={index} className={className}>{value}</span>;
		});
	}

	let diff = useMemo(() => getDiff(oldLabel, newLabel, canAbbreviate), [oldLabel, newLabel, canAbbreviate]);

	let id = `${itemID}-${fieldName}`;
	return (
		<div className={cx('diff-table-field', { disabled: isDisabled, readonly: readonly })}>
			<div className="checkbox-name-wrapper">
				<input
					id={id}
					className="checkbox"
					type="checkbox"
					checked={!isDisabled}
					onChange={handleCheckboxChange}
				/>
				<label className="name" htmlFor={id}>{fieldLabel}</label>
			</div>
			<div className="value" onClick={handleClick}>{diff}</div>
		</div>
	);
};

Field.propTypes = {
	itemID: PropTypes.number.isRequired,
	readonly: PropTypes.bool.isRequired,
	field: PropTypes.object.isRequired,
	onSetDisabled: PropTypes.func.isRequired,
	onExpand: PropTypes.func.isRequired
};

export default Field;
