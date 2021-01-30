/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Center for History and New Media
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

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { IntlProvider, useIntl } from "react-intl";
import { humanReadableSize } from 'components/utils';

Components.utils.import("resource://gre/modules/osfile.jsm");

const StorageBreakdown = () => {
	const intl = useIntl();

	const [loading, setLoading] = useState(true);
	const [partitions, setPartitions] = useState([]);

	useEffect(() => {
		const calculateStorage = async () => {
			let libraries = Zotero.Libraries.getAll().map((library) => {
				return {
					libraryID: library.libraryID,
					name: library.name,
					size: 0,
					count: 0
				};
			});

			setPartitions(libraries.map(library => library));
			let update = 0;

			await Zotero.Promise.all(libraries.map(async (partition, index) => {
				let items = await Zotero.Items.getAll(partition.libraryID);

				const getFileSize = async (attachmentFile) => {
					if (!attachmentFile.name.startsWith('.')) {
						try {
							let size = (await OS.File.stat(attachmentFile.path)).size;
							libraries[index].size += size;
						}
						catch (e) {
							if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
								// File may or may not exist on disk, but we
								// don't care so swallow this error
							}
							else {
								throw e;
							}
						}
					}

					if (update > 200) {
						setPartitions(libraries.map(library => library));
						update = 0;
					}
					else {
						update += 1;
					}
				};

				await Zotero.Promise.all(items.map(async (item) => {
					if (item.isImportedAttachment()) {
						libraries[index].count += 1;

						await Zotero.File.iterateDirectory(
							Zotero.Attachments.getStorageDirectory(item).path,
							getFileSize
						);
					}
				}));
			}));

			setLoading(false);
			setPartitions(libraries);
		};

		calculateStorage();
	}, []);

	const partitionSum = partitions.reduce((sum, partition) => sum + partition.size, 0);
	const countSum = partitions.reduce((sum, partition) => sum + partition.count, 0);

	return (
		<div className="storage-breakdown">
			<div>
				<div className="title">
					{ Zotero.getString('zotero.preferences.sync.fileSyncing.breakdown') }
				</div>
				<div>
					{ Zotero.getString(
						'zotero.preferences.sync.fileSyncing.breakdown.detail',
						[countSum, humanReadableSize(partitionSum, 1)],
					) }
				</div>
				<div
					mode="undetermined"
					className={ cx('downloadProgress', { hidden: !loading }) }
				>
					<div className="progress-bar"></div>
				</div>
				<div className="partitions">
					{ partitions.map((partition, index) => {
						return (
							<div
								key={ index }
								className="partition"
							>
								<div className="top-row">
									<span>
										{ partition.name }
									</span>
									<span>
										{ humanReadableSize(partition.size, 1) }
									</span>
								</div>
								<div>
									{ Zotero.getString(
										'zotero.preferences.sync.fileSyncing.breakdown.attachments',
										partition.count,
										partition.count
									) }
								</div>
							</div>
						);
					}) }
				</div>
			</div>

			<div className="dialog-buttons">
				<button
					default="noop"
					className="button-native"
					onClick={ () => window.close() }
				>
					{ intl.formatMessage({ id: 'zotero.general.ok' }) }
				</button>
			</div>
		</div>
	);
};


StorageBreakdown.propTypes = {
	loading: PropTypes.number,
	partitions: PropTypes.array
};

document.title = Zotero.getString('zotero.preferences.sync.fileSyncing.breakdown');

ReactDOM.render(
	<IntlProvider
		locale={Zotero.locale}
		messages={Zotero.Intl.strings}
	>
		<StorageBreakdown/>
	</IntlProvider>,
	document.getElementById('root')
);
