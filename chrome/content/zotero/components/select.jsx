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

'use strict';

import React, { memo, useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

function Select(props) {

	const [selected, setSelected] = useState(props.selected);
	const [options, setOptions] = useState(props.options);
	
	const [menuOpen, setMenuOpen] = useState(false);
	
	const handleOnChange = useCallback((option) => {
		setSelected(option);
		props.onChange(option);
	}, []);
	
	

	return (
		<div
			className="menulist"
			value={ selected }
			onChange={ handleOnChange }
			onClick={ e => setMenuOpen(!menuOpen) }
			disabled={ props.disabled }
		>
			<div
				className={ cx('menupopup', menuOpen ? 'hidden' : '') }
			>
				{ options.map(option => (
					<div
						className="menuitem"
						key={ option.libraryID }
						value={ option.libraryID }
						data-selected={ selected === option.libraryID }
					>
						{ option.name }
					</div>
				)) }
			</div>
			{ selected }
		</div>
	);
}


Select.propTypes = {
	options: PropTypes.array,
	selected: PropTypes.string,
	onChange: PropTypes.func,
	disabled: PropTypes.bool
};


Select.defaultProps = {
	options: [],
	selected: '',
	onChange: () => Promise.resolve(),
	disabled: false
};


export default memo(Select);
