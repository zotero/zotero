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

import React, { memo, useState } from 'react';
import PropTypes from 'prop-types';

function CreateParent({ loading, item }) {
	return (
		<div
			style={{
				paddingLeft: '1em',
				paddingBottom: '0.5em',
				minWidth: '400px'
			}}
		>
			<span
				style={{ fontSize: '1.4em' }}
			>
				Create parent item for: <strong>{ item.getField('title') }</strong>
			</span>
			<div
				style={{
					margin: '1em 0',
					position: 'relative'
				}}
			>
				<input
					id="parent-item-identifier"
					placeholder="Enter an ISBN, DOI, PMID, or arXiv ID to identify this item:"
					size="50"
					disabled={ loading }
					style={{
						width: '100%'
					}}
				/>
				<div
					className="downloadProgress"
					mode="undetermined"
					style={{
						display: loading ? '' : 'none',
						position: 'absolute',
						top: '3px',
						left: '2px',
						right: '-1.5em'
					}}
				>
					<div
						className="progress-bar"
						style={{
							width: '100%',
							height: '100%',
							opacity: 0.5
						}}
					></div>
				</div>
			</div>
		</div>
	);
}


CreateParent.propTypes = {
	loading: PropTypes.bool,
	item: PropTypes.object,
};


export default memo(CreateParent);
