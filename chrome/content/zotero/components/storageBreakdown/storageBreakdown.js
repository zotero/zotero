/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2020 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org

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
import cx from 'classnames';

function StorageBreakdown({ loading, partitions }) {
	const partitionSum = partitions.reduce((sum, partition) => sum + partition.size, 0);
	const countSum = partitions.reduce((sum, partition) => sum + partition.count, 0);

	let total = partitionSum;
	let unitsIndex = 0;
	while (total > 1023 && unitsIndex < 5) {
		total = Math.floor(total / 1024);
		unitsIndex += 1;
	}
	const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];

	const detail = countSum + ' items totaling ' + total + ' ' + units[unitsIndex];

	let partitionLeft = 0;
	return (
		<div className="storage-breakdown">
			<div className="title">
				{ loading > 0 && 'Calculating your storage...'}
			</div>
			<div className="title">
				{ detail }
			</div>
			<div
				mode="undetermined"
				className={ cx('downloadProgress', { hidden: !loading }) }
			>
				<div className="progress-bar"></div>
			</div>
			<div className="partitions">
				{ partitions.map((partition, index) => {
					// Save the current value before we add to it
					let myLeft = partitionLeft;

					// Get width and add that to get the next element's left value
					// 300px is the width of the partitions div in pixels
					let width = Math.floor(partition.size / partitionSum * 300);
					partitionLeft += width;

					return (
						<div
							key={ index }
							className={ cx('partition', 'p' + (index % 2)) }
							style={{
								left: myLeft + 'px',
								width: width + 'px'
							}}
						>
							<div className="tooltip-container">
								<span className="tooltip">
									{ partition.name }
								</span>
							</div>
						</div>
					);
				}) }
			</div>
		</div>
	);
}


StorageBreakdown.propTypes = {
	loading: PropTypes.number,
	partitions: PropTypes.array
};


export default memo(StorageBreakdown);
