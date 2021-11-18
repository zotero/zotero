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
import React, { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { scrollIntoViewIfNeeded } from './utils';

const ImportDatabaseTable = memo(forwardRef(({ files, onChange }, ref) => {
	const [selectedIndex, setSelectedIndex] = useState(null);
	const bodyRef = useRef(null);
	const entries = files.map((file) => {
		let name = file.name
			.replace(/\.sqlite$/, '')
			.replace(/@www\.mendeley\.com$/, '');
		if (name === 'online') {
			name = Zotero.getString('dataDir.default', 'online.sqlite');
		}
		const lastModified = file.lastModified.toLocaleString() + ' ';
		const size = Zotero.getString('general.nMegabytes', (file.size / 1024 / 1024).toFixed(1)) + ' ';

		return { name, lastModified, size };
	});

	useImperativeHandle(ref, () => ({
		reset: () => {
			setSelectedIndex(null);
		},
	}));

	const handleClick = useCallback((ev) => {
		const newIndex = parseInt(ev.currentTarget.dataset.key);
		if (newIndex !== selectedIndex) {
			setSelectedIndex(newIndex);
			onChange(files[newIndex]);
		}
		if (bodyRef.current && document.activeElement !== bodyRef.current) {
			bodyRef.current.focus();
		}
	}, [files, onChange, selectedIndex]);

	const handleKeyDown = useCallback((ev) => {
		if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
			var newIndex = selectedIndex === null ? 0 : selectedIndex;
			var scrollOpts = {};
			
			if (ev.key === 'ArrowUp') {
				newIndex = Math.max(0, newIndex - 1);
				scrollOpts = { block: 'start', inline: 'nearest' };
			}
			else if (ev.key === 'ArrowDown') {
				newIndex = Math.min(entries.length - 1, newIndex + 1);
				scrollOpts = { block: 'end', inline: 'nearest' };
			}
			setSelectedIndex(newIndex);

			const nodeIndexElement = bodyRef.current.querySelector(`[data-key="${newIndex}"]`);
			if (bodyRef.current) {
				scrollIntoViewIfNeeded(nodeIndexElement, bodyRef.current, scrollOpts);
			}
			ev.preventDefault();
		}
	}, [entries, selectedIndex, bodyRef]);

	return (
		<div
			className="data-table import-database-table"
			role="grid"
		>
			<div role="row" className="header">
				<div
					className="cell"
					role="columnheader"
					style={ { width: '60%' } }
				>
					{ Zotero.getString('import.database') }
				</div>
				<div
					className="cell"
					role="columnheader"
					style={ { width: '30%', 'min-width': '170px' } }
				>
					{ Zotero.getString('import.lastModified') }
				</div>
				<div
					className="cell"
					role="columnheader"
					style={ { width: '10%', 'min-width': '55px' } }
				>
					{ Zotero.getString('import.size') }
				</div>
			</div>
			<div className="body" onKeyDown={ handleKeyDown } ref={ bodyRef }>
				{ entries.map((entry, index) => (
					<div
						className={ cx('row', { selected: index === selectedIndex }) }
						data-key={ index }
						key={ index }
						onClick={ handleClick }
						role="row"
					>
						<div
							style={ { width: '60%' } }
							className="cell"
							role="gridcell"
						>
							{ entry.name }
						</div>
						<div
							style={ { width: '30%', 'min-width': '170px' } }
							className="cell"
							role="gridcell"
						>
							{ entry.lastModified }
						</div>
						<div
							style={ { width: '10%', 'min-width': '55px' } }
							className="cell"
							role="gridcell"
						>
							{ entry.size }
						</div>
					</div>
				)) }
			</div>
		</div>
	);
}));

ImportDatabaseTable.displayName = 'ImportDatabaseTable';

ImportDatabaseTable.propTypes = {
	files: PropTypes.shape({
		lastModified: PropTypes.string,
		name: PropTypes.string,
		size: PropTypes.number,
	}),
	onChange: PropTypes.func,
};

export default ImportDatabaseTable;
