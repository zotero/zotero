/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
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

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { IntlProvider, useIntl } from 'react-intl';
import cx from "classnames";
import { humanReadableSize } from 'components/utils';

Components.utils.import("resource://gre/modules/osfile.jsm");

const customPreferences = (id) => {
	const pref = 'sync.storage.groups.' + id;

	return {
		enabled: Zotero.Prefs.get(pref + '.custom') || false,
		sync: Zotero.Prefs.get(pref + '.sync') || false,
		downloadMode: Zotero.Prefs.get(pref + '.downloadMode') || 'on-sync'
	};
};

const Group = ({ id, name, prefs, count, size, onChangeEnabled, onChangeSync, onChangeMode }) => {
	const intl = useIntl();

	const globalDownloadMode = Zotero.Prefs.get('sync.storage.downloadMode.groups');
	const globalSync = Zotero.Prefs.get('sync.storage.groups.enabled');

	const canClearCache = Zotero.Prefs.get('sync.storage.timeToLive.enabled')
		&& (prefs.enabled
			? (prefs.sync && prefs.downloadMode === 'on-demand')
			: (globalSync && globalDownloadMode === 'on-demand'));

	const [clearButtonEnabled, setClearButtonEnabled] = useState(true);

	const handleClear = async () => {
		setClearButtonEnabled(false);

		let libraryID = Zotero.Groups.getLibraryIDFromGroupID(id);
		await Zotero.Sync.Storage.Cache.cleanCacheForLibrary(libraryID);

		setClearButtonEnabled(true);
	};

	return (
		<div className="group">
			{ id > 0 && <div className="group-header">
				<div className="group-header-label">
					{ name }
				</div>

				<input
					id={ 'custom-' + id }
					type="checkbox"
					checked={ prefs.enabled }
					onChange={ onChangeEnabled }
				/>
				<label htmlFor={ 'custom-' + id }>
					{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.groups.custom.use' }) }
				</label>
			</div> }

			{ prefs.enabled && <div className="group-settings">
				<div className="setting-enabled-box">
					<input
						id={ 'enabled-' + id }
						type="checkbox"
						checked={ prefs.sync }
						onChange={ onChangeSync }
					/>
					<label htmlFor={ 'enabled-' + id }>
						{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.groups.sync' }) }
					</label>
				</div>

				<div className="setting-downloadMode-box">
					<label htmlFor={ 'downloadMode-' + id }>
						{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.download' }) }
					</label>
					<select
						id={ 'downloadMode-' + id }
						value={ prefs.downloadMode }
						disabled={ !prefs.sync }
						onChange={ onChangeMode }
					>
						<option value="on-demand">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.download.onDemand' }) }
						</option>
						<option value="on-sync">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.download.atSyncTime' }) }
						</option>
					</select>
				</div>
			</div> }

			{ id > 0 && <div className="group-footer">
				<div>
					{ Zotero.getString(
						'zotero.preferences.sync.fileSyncing.breakdown.attachments',
						count,
						count
					) } - { humanReadableSize(size, 1) }
				</div>
				{ canClearCache && <button
					onClick={ handleClear }
					disabled={ !clearButtonEnabled }
					className="button-native">
					{ Zotero.getString('zotero.preferences.sync.fileSyncing.clear') }
				</button> }
			</div> }
		</div>
	);
};

Group.propTypes = {
	id: PropTypes.number,
	name: PropTypes.string,
	prefs: PropTypes.object,
	count: PropTypes.number,
	size: PropTypes.number,
	onChangeEnabled: PropTypes.func,
	onChangeSync: PropTypes.func,
	onChangeMode: PropTypes.func
};

const GroupCustomSettings = () => {
	const intl = useIntl();

	const [loading, setLoading] = useState(true);
	const [groupsState, setGroups] = useState([]);

	// Global settings
	const [globalPrefs, setGlobalPrefs] = useState({
		enabled: true,
		sync: Zotero.Prefs.get('sync.storage.groups.enabled'),
		downloadMode: Zotero.Prefs.get('sync.storage.downloadMode.groups')
	});

	// Simply turn off custom settings for all groups
	const revertAllGroups = () => {
		const newGroups = groupsState.map((group) => {
			Zotero.Prefs.set('sync.storage.groups.' + group.id + '.custom', false);
			group.prefs.enabled = false;
			return group;
		});

		setGroups(newGroups);
	};

	// Asynchronously load all group libraries
	useEffect(() => {
		(async () => {
			let apiKey = await Zotero.Sync.Data.Local.getAPIKey();
			let client = Zotero.Sync.Runner.getAPIClient({ apiKey });
			let apiGroups = [];
			try {
				// Load up remote groups
				let keyInfo = await Zotero.Sync.Runner.checkAccess(client, { timeout: 5000 });
				apiGroups = await client.getGroups(keyInfo.userID);
			}
			catch (e) {
				// Connection problems
				if ((e instanceof Zotero.HTTP.UnexpectedStatusException)
					|| (e instanceof Zotero.HTTP.TimeoutException)
					|| (e instanceof Zotero.HTTP.BrowserOfflineException)) {
					Zotero.alert(
						window,
						Zotero.getString('general.error'),
						Zotero.getString('sync.error.checkConnection', Zotero.clientName)
					);
				}
				else {
					throw e;
				}
				window.close();
			}

			let librariesToSkip = JSON.parse(Zotero.Prefs.get('sync.librariesToSkip') || '[]');

			// Sort groups
			let collation = Zotero.getLocaleCollation();
			apiGroups.sort((a, b) => collation.compareString(1, a.data.name, b.data.name));

			let sizeGroups = apiGroups
				.filter(group => librariesToSkip.indexOf("G" + group.id) === -1)
				.map(group => ({
					name: group.data.name,
					id: group.id,
					prefs: customPreferences(group.id),
					size: 0,
					count: 0
				}));
			// Put them into state
			setGroups(sizeGroups);

			let update = 0;

			await Zotero.Promise.all(sizeGroups.map(async (group, index) => {
				let libraryID = Zotero.Groups.getLibraryIDFromGroupID(group.id);
				let items = await Zotero.Items.getAll(libraryID);

				const getFileSize = async (attachmentFile) => {
					if (attachmentFile.name.startsWith('.')) {
						return;
					}

					try {
						let size = (await OS.File.stat(attachmentFile.path)).size;
						sizeGroups[index].size += size;
					}
					catch (e) {
						if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
							// File may or may not exist on disk, but we
							// don't care so swallow this error
						}
						else {
							Zotero.logError(e);
							return;
						}
					}

					if (update > 200) {
						setGroups(sizeGroups.map(group => group));
						update = 0;
					}
					else {
						update += 1;
					}
				};

				await Zotero.Promise.all(items.map(async (item) => {
					if (!item.isImportedAttachment()) {
						return;
					}

					sizeGroups[index].count += 1;

					await Zotero.File.iterateDirectory(
						Zotero.Attachments.getStorageDirectory(item).path,
						getFileSize
					);
				}));
			}));

			setLoading(false);
			setGroups(sizeGroups.map(group => group));
		})();
	}, []);

	// Update the given pref and change the state
	const updatePrefInGroups = (id, pref, value) => {
		if (id) {
			const newGroups = groupsState.map((group) => {
				if (group.id === id) {
					group.prefs[pref] = value;
				}

				return group;
			});

			setGroups(newGroups);
		}
		else {
			const newGlobalPrefs = { ...globalPrefs };
			newGlobalPrefs[pref] = value;
			setGlobalPrefs(newGlobalPrefs);
		}
	};

	const resetLastCleanedValues = function (groupID) {
		Zotero.Libraries.getAll()
			.filter((library) => {
				if (groupID) {
					return Zotero.Groups.getGroupIDFromLibraryID(library.libraryID) === groupID;
				}
				else {
					return library.libraryID !== Zotero.Libraries.userLibraryID;
				}
			})
			.forEach((library) => {
				let groupID = Zotero.Groups.getGroupIDFromLibraryID(library.libraryID);
				if (!Zotero.Prefs.get('sync.storage.groups.' + groupID + '.custom')) {
					Zotero.Sync.Storage.Local.lastCacheClean.set(
						library.libraryID,
						0
					);
				}
			});
	};

	// Change listeners for each custom settings section
	const handleChangeEnabled = (event, id) => {
		Zotero.Prefs.set('sync.storage.groups.' + id + '.custom', event.target.checked);
		updatePrefInGroups(id, 'enabled', event.target.checked);
	};

	const handleChangeSync = (event, id) => {
		if (id) {
			Zotero.Prefs.set('sync.storage.groups.' + id + '.sync', event.target.checked);
		}
		else {
			Zotero.Prefs.set('sync.storage.groups.enabled', event.target.checked);
		}
		updatePrefInGroups(id, 'sync', event.target.checked);
	};

	const handleChangeMode = (event, id) => {
		if (id) {
			Zotero.Prefs.set('sync.storage.groups.' + id + '.downloadMode', event.target.value);
			resetLastCleanedValues(id);
		}
		else {
			Zotero.Prefs.set('sync.storage.downloadMode.groups', event.target.value);
			resetLastCleanedValues();
		}
		updatePrefInGroups(id, 'downloadMode', event.target.value);
	};

	return (
		<div className="group-files-sync-container">
			<label
				className="global-settings-label"
				htmlFor="global-settings"
			>
				{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.groups.global' }) }
			</label>

			<div className="global-settings">
				<Group
					id={ 0 }
					prefs={ globalPrefs }
					onChangeSync={ event => handleChangeSync(event, false) }
					onChangeMode={ event => handleChangeMode(event, false) }
				/>

				<div className="reset-container">
					<button
						className="button-native"
						onClick={ revertAllGroups }
					>
						{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.groups.revert' }) }
					</button>
				</div>
			</div>

			<label
				className="custom-settings-label"
				htmlFor="custom-settings"
			>
				{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.groups.custom' }) }
			</label>

			<div
				id="custom-settings"
				className="groups-file-sync-groups"
			>
				<div
					mode="undetermined"
					className={ cx('downloadProgress', { hidden: !loading }) }
				>
					<div className="progress-bar"></div>
				</div>
				{ groupsState.length === 0 && <div className="group">
					{ Zotero.getString('zotero.preferences.sync.librariesToSync.loadingLibraries') }
				</div> }
				{ groupsState.map((group) => {
					return (
						<Group
							key={ group.id }
							name={ group.name }
							id={ group.id }
							prefs={ group.prefs }
							count={ group.count }
							size={ group.size }
							onChangeEnabled={ event => handleChangeEnabled(event, group.id) }
							onChangeSync={ event => handleChangeSync(event, group.id) }
							onChangeMode={ event => handleChangeMode(event, group.id) }
						/>
					);
				}) }
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

ReactDOM.render(
	<IntlProvider
		locale={ Zotero.locale }
		messages={ Zotero.Intl.strings }
	>
		<GroupCustomSettings />
	</IntlProvider>,
	document.getElementById('root')
);

document.title = Zotero.getString('zotero.preferences.sync.fileSyncing.groups.title');
