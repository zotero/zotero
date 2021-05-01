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
import { humanReadableSize } from 'components/utils';
import ProgressMeter from 'components/progressMeter';

const customPreferences = (id) => {
	const pref = 'sync.storage.groups.' + id;

	return {
		enabled: Zotero.Prefs.get(pref + '.custom') || false,
		sync: Zotero.Prefs.get(pref + '.sync') || false,
		downloadMode: Zotero.Prefs.get(pref + '.downloadMode') || 'on-sync'
	};
};

const Group = ({ id, name, prefs, count, size, clearButtonEnabled, onChangeEnabled, onChangeSync, onChangeMode, onClear }) => {
	const intl = useIntl();

	const globalDownloadMode = Zotero.Prefs.get('sync.storage.downloadMode.groups');
	const globalSync = Zotero.Prefs.get('sync.storage.groups.enabled');

	const canClearCache = Zotero.Prefs.get('sync.storage.timeToLive.enabled')
		&& (prefs.enabled
			? (prefs.sync && prefs.downloadMode === 'on-demand')
			: (globalSync && globalDownloadMode === 'on-demand'));

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
					onClick={ onClear }
					disabled={ !clearButtonEnabled }
					className="button-native">
					{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.clear' }) }
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
	clearButtonEnabled: PropTypes.bool,
	onChangeEnabled: PropTypes.func,
	onChangeSync: PropTypes.func,
	onChangeMode: PropTypes.func,
	onClear: PropTypes.func
};

const GroupCustomSettings = () => {
	const intl = useIntl();

	const [loading, setLoading] = useState(true);
	const [groups, setGroups] = useState([]);

	// Global settings
	const [globalPrefs, setGlobalPrefs] = useState({
		enabled: true,
		sync: Zotero.Prefs.get('sync.storage.groups.enabled'),
		downloadMode: Zotero.Prefs.get('sync.storage.downloadMode.groups')
	});

	// Revert groups to global settings by turning off all custom settings preferences
	const revertAllGroups = () => {
		setGroups(groups => groups.map((group) => {
			Zotero.Prefs.set('sync.storage.groups.' + group.id + '.custom', false);
			group.prefs.enabled = false;
			return group;
		}));
	};

	// Update state from new storage breakdown information
	const updateGroups = (storageBreakdown) => {
		setGroups(groups => groups.map((group) => {
			if (storageBreakdown[group.libraryID]) {
				group.size = storageBreakdown[group.libraryID].size;
				group.count = storageBreakdown[group.libraryID].count;
			}
			return group;
		}));
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

			// Put them into state
			setGroups(apiGroups
				.filter(group => librariesToSkip.indexOf("G" + group.id) === -1)
				.map(group => ({
					name: group.data.name,
					id: group.id,
					libraryID: Zotero.Groups.getLibraryIDFromGroupID(group.id),
					prefs: customPreferences(group.id),
					canClear: true,
					size: 0,
					count: 0
				})));

			let storageBreakdown = await Zotero.Sync.Storage.Cache
				.calculateStorageBreakdown(updateGroups);

			setLoading(false);
			updateGroups(storageBreakdown);
		})();
	}, []);

	// Update the given pref and change the state
	const updatePrefInGroups = (id, pref, value) => {
		if (id) {
			setGroups(groups => groups.map((group) => {
				if (group.id === id) {
					group.prefs[pref] = value;
				}
				return group;
			}));
		}
		else {
			const newGlobalPrefs = { ...globalPrefs };
			newGlobalPrefs[pref] = value;
			setGlobalPrefs(newGlobalPrefs);
		}
	};

	// Change last cleaned values to zero because preferences have changed
	const resetLastCleanedValues = function (groupID) {
		Zotero.Libraries.getAll()
			.filter((library) => {
				if (library.libraryID === Zotero.Libraries.userLibraryID) {
					return false;
				}

				return groupID
					? Zotero.Groups.getGroupIDFromLibraryID(library.libraryID) === groupID
					: true;
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

	const handleClear = async (groupID, groupName) => {
		const description = Zotero.getString(
			'zotero.preferences.sync.fileSyncing.clear.desc',
			groupName);

		// Prompt to confirm action
		if (Zotero_Preferences.Sync.cleanLibraryStoragePrompt(description) !== 0) {
			return;
		}

		// Disable clear button
		setGroups(groups => groups.map((group) => {
			if (group.id === groupID) {
				group.canClear = false;
			}

			return group;
		}));

		// Clean storage cache
		const libraryID = Zotero.Groups.getLibraryIDFromGroupID(groupID);
		await Zotero.Sync.Storage.Cache.cleanCacheForLibrary(libraryID);

		// Recalculate storage breakdown for this group
		await Zotero.Sync.Storage.Cache.calculateStorageBreakdown(
			updateGroups,
			[libraryID]
		);

		// Enable clear button again
		setGroups(groups => groups.map((group) => {
			if (group.id === groupID) {
				group.canClear = true;
			}

			return group;
		}));
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
				<ProgressMeter hidden={ !loading } />
				{ groups.length === 0 && <div className="group">
					{ Zotero.getString('zotero.preferences.sync.librariesToSync.loadingLibraries') }
				</div> }
				{ groups.map((group) => {
					return (
						<Group
							key={ group.id }
							name={ group.name }
							id={ group.id }
							prefs={ group.prefs }
							count={ group.count }
							size={ group.size }
							clearButtonEnabled={ group.canClear }
							onChangeEnabled={ event => handleChangeEnabled(event, group.id) }
							onChangeSync={ event => handleChangeSync(event, group.id) }
							onChangeMode={ event => handleChangeMode(event, group.id) }
							onClear={ () => handleClear(group.id, group.name) }
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
