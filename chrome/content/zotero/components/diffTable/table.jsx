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

import React, { useState, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';

import { CSSIcon } from '../icons';

import Field from './field';

const Table = React.forwardRef((props, ref) => {
	const [rows, setRows] = useState([]);

	useImperativeHandle(ref, () => ({
		setRows
	}));

	function handleFieldToggle(itemID, fieldName) {
		props.onToggle(itemID, fieldName);
	}

	function handleFieldExpand(itemID, fieldName) {
		props.onExpand(itemID, fieldName);
	}

	function handleMouseDown(event) {
		if (!event.target.closest('.value')) {
			let win = event.target.ownerDocument.defaultView;
			win.getSelection().removeAllRanges();
		}
	}

	return (
		<div className="diff-table" onMouseDown={handleMouseDown}>
			<div className="body">
				{rows.map((row) => {
					const isDone = row.fields.length === 0 || row.isDone;
					const hasPendingChanges = row.fields.find(field => !field.isDisabled);

					return (<div key={row.itemID} className="row">
						<div className="right fields-view">
							<div className="header" onClick={() => props.onOpenItem(row.itemID)}>
								<div className="status">
									{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && isDone && <CSSIcon name="tick"/>
									|| row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && row.fields.length && <CSSIcon name="edit"/>
									|| row.status === Zotero.UpdateMetadata.ROW_PROCESSING && <div className="icon zotero-spinner-16" status="animate"/>
									|| row.status === Zotero.UpdateMetadata.ROW_FAILED && <CSSIcon name="cross"/>
									|| row.status === Zotero.UpdateMetadata.ROW_NO_METADATA && <CSSIcon name="error"/>
									|| <CSSIcon name="aaa"/>}
								</div>
								<div className="title">{row.title}</div>
							</div>
							{row.message && <div className="message">{row.message}</div>}
							<div className="fields">
								{row.fields.map(field => (
									<Field
										key={field.fieldName}
										itemID={row.itemID}
										readonly={row.isDone}
										field={field}
										onToggle={handleFieldToggle}
										onExpand={handleFieldExpand}
									/>
								))}
							</div>
							{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && !isDone && (
								<div className="footer">
									<button
										className="toggle-button"
										onClick={() => props.onToggle(row.itemID)}>
										{Zotero.getString(
											hasPendingChanges ? 'zotero.general.deselectAll' : 'zotero.general.selectAll'
										)}
									</button>
									<div className="spacer"></div>
									<button
										className="ignore-button"
										onClick={ () => props.onIgnore(row.itemID) }
										data-l10n-id="update-metadata-ignore"
									/>
									<button
										className="apply-button"
										default={ true }
										disabled={ !hasPendingChanges }
										onClick={ () => props.onApply(row.itemID) }
										data-l10n-id="update-metadata-apply"
									/>
								</div>
							)}
							<div className="separator"></div>
						</div>
					</div>);
				})}
			</div>
		</div>
	);
});

Table.propTypes = {
	onToggle: PropTypes.func,
	onApply: PropTypes.func,
	onIgnore: PropTypes.func,
	onOpenItem: PropTypes.func
};

export default Table;
