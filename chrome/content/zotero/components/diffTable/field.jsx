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

import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DMP from 'diff-match-patch';

const dmp = new DMP();

const MAX_DIFF_SEGMENT_LENGTH = 35;

// TODO: Improve performance by reducing re-renders

const Field = (props) => {
	const { itemID, field, onToggle } = props;
	const { fieldName, fieldLabel, oldLabel, newLabel, isAccepted } = field;

	function shrink(str) {
		if (str.length > MAX_DIFF_SEGMENT_LENGTH) {
			return str.slice(0, 30) + '[…]' + str.slice(-30);
		}
		return str;
	}

	function handleClick() {
		onToggle(itemID, fieldName, !isAccepted);
	}

	function getDiff(oldValue, newValue) {
		// As described in https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs#word-mode
		var a = dmp.diff_wordsToChars_(oldValue, newValue);
		var lineText1 = a.chars1;
		var lineText2 = a.chars2;
		var lineArray = a.lineArray;
		var diffs = dmp.diff_main(lineText1, lineText2, false);
		dmp.diff_charsToLines_(diffs, lineArray);
		// dmp.diff_cleanupSemantic(diffs);

		if (!diffs) return [];

		if (diffs.length === 2 && diffs[0][0] === -1 && diffs[1][0] === 1 && diffs[0][1].length + diffs[1][1].length > 60) {
			return [
				<span className="removed">{shrink(oldLabel)}</span>, <br/>,
				<span className="added">{shrink(newLabel)}</span>
			];
		}

		return diffs.map((part, index) => {
			let className = part[0] === 1 ? 'added' : part[0] === -1 ? 'removed' : '';
			let value = part[1];
			value = shrink(value);
			return <span key={index} className={className}>{value}</span>
		});
	}

	let diff = getDiff(oldLabel, newLabel);

	return (
		<div
			className={cx('diff-table-field', { accepted: isAccepted })}
			onClick={handleClick}
		>
			<div className="name">{newLabel ? fieldLabel + ':' : <s>{fieldLabel}:</s>}</div>
			<div className="value">{diff}</div>
		</div>
	);
}

Field.propTypes = {
	itemID: PropTypes.number.isRequired,
	field: PropTypes.object.isRequired,
	onToggle: PropTypes.func.isRequired
};

export default Field;
