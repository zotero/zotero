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

import React from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import DMP from 'diff-match-patch';

const dmp = new DMP();

const MAX_DIFF_SEGMENT_LENGTH = 60;

// TODO: Improve performance by reducing re-renders

const Field = (props) => {
	const { itemID, field, onToggle } = props;
	const { fieldName, fieldLabel, oldLabel, newLabel, isAccepted } = field;

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
		if (pos === 'start' && str.length > MAX_DIFF_SEGMENT_LENGTH / 2) {
			return '…' + str.slice(cut(str, str.length - MAX_DIFF_SEGMENT_LENGTH / 2 - 1));
		}
		else if (pos === 'middle' && str.length > MAX_DIFF_SEGMENT_LENGTH) {
			return str.slice(cut(str, MAX_DIFF_SEGMENT_LENGTH / 2 - 1)) + '[…]' + str.slice(cut(str, str.length - MAX_DIFF_SEGMENT_LENGTH / 2 - 1));
		}
		else if (pos === 'end' && str.length > MAX_DIFF_SEGMENT_LENGTH / 2) {
			return str.slice(0, cut(str, MAX_DIFF_SEGMENT_LENGTH / 2 - 1)) + '…';
		}
		else if (pos === 'single' && str.length > MAX_DIFF_SEGMENT_LENGTH) {
			return str.slice(0, cut(str, MAX_DIFF_SEGMENT_LENGTH - 1)) + '…';
		}

		return str;
	}

	function handleClick() {
		onToggle(itemID, fieldName, !isAccepted);
	}

	function getDiff(oldValue, newValue) {
		// As described in https://github.com/google/diff-match-patch/wiki/Line-or-Word-Diffs#word-mode
		var a = dmp.diff_wordsToChars_(oldValue, newValue, [' ', ',']);
		var lineText1 = a.chars1;
		var lineText2 = a.chars2;
		var lineArray = a.lineArray;
		var diffs = dmp.diff_main(lineText1, lineText2, false);
		dmp.diff_charsToLines_(diffs, lineArray);
		// dmp.diff_cleanupSemantic(diffs);

		if (!diffs) return [];

		let commonNum = diffs.reduce((acc, value) => acc + (value[0] === 0 ? value[1].length : 0), 0);
		let changedNum = diffs.reduce((acc, value) => acc + (value[0] !== 0 ? value[1].length : 0), 0);
		
		if (commonNum > 0 && changedNum / commonNum > 3 || diffs.length === 2 && diffs[0][0] === -1 && diffs[1][0] === 1 && diffs[0][1].length + diffs[1][1].length > 60) {
			return [
				<span className="removed">{shrink(oldLabel, 'single')}</span>, <br/>,
				<span className="added">{shrink(newLabel, 'single')}</span>
			];
		}

		return diffs.map((part, index) => {
			let className = part[0] === 1 ? 'added' : part[0] === -1 ? 'removed' : '';
			let value = part[1];
			value = shrink(value, diffs.length === 1 && 'single' || index === 0 && 'start' || index === diffs.length - 1 && 'end' || 'middle');
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
