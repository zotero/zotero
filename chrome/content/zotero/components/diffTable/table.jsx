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

import React, { useState, useImperativeHandle } from 'react';
import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';

import {
	IconTick,
	IconCross,
	IconArrowRefresh,
	IconPuzzleArrow,
	IconBulletBlueEmpty
} from '../icons';

import Field from './field';

const Table = React.forwardRef((props, ref) => {
	const [rows, setRows] = useState([]);

	useImperativeHandle(ref, () => ({
		setRows
	}));

	function handleFieldToggle(itemID, fieldName) {
		props.onToggle(itemID, fieldName);
	}

	return (
		<div className="diff-table">
			<div className="body">
				{rows.map(row => (
					<div key={row.itemID} className="row">
						<div className="right fields-view">
							<div className="header" onDoubleClick={() => props.onDoubleClick(row.itemID)}>
								{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && row.fields.length && <IconPuzzleArrow/>
								|| row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && !row.fields.length && <IconTick/>
								|| row.status === Zotero.UpdateMetadata.ROW_PROCESSING && <IconArrowRefresh/>
								|| row.status === Zotero.UpdateMetadata.ROW_FAILED && <IconCross/>
								|| <IconBulletBlueEmpty/>}
								<div className="title">{row.title}</div>
							</div>
							{row.message && <div className="message">{row.message}</div>}
							<div className="fields">
								{row.fields.map(field =>
									<Field key={field.fieldName} itemID={row.itemID} field={field} onToggle={handleFieldToggle}/>
								)}
							</div>
							{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && row.fields.length > 0 && (
								<div className="footer">
									<button
										className="toggle-button"
										onClick={() => props.onToggle(row.itemID)}>
										<FormattedMessage
											id={row.fields.find(field => field.isAccepted) ?
												'zotero.general.deselectAll' : 'zotero.general.selectAll'}
										/>
									</button>
									<button className="apply-button" onClick={() => props.onApply(row.itemID)}>
										<FormattedMessage id="zotero.general.apply"/>
									</button>
								</div>)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
});

Table.propTypes = {
	onToggle: PropTypes.func,
	onDoubleClick: PropTypes.func
};

export default Table;
