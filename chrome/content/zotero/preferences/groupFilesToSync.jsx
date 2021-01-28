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

const customPreferences = (id) => {
	const pref = 'sync.storage.groups.' + id;

	return {
		enabled: Zotero.Prefs.get(pref + '.custom') || false,
		sync: Zotero.Prefs.get(pref + '.sync') || false,
		downloadMode: Zotero.Prefs.get(pref + '.downloadMode') || 'on-sync',
		ttlEnabled: Zotero.Prefs.get(pref + '.ttl') || false,
		ttlValue: Zotero.Prefs.get(pref + '.ttl.value') || 30
	};
};

const Group = ({ id, name, prefs, onChangeEnabled, onChangeSync, onChangeMode, onChangeTTLEnabled, onChangeTTLValue }) => {
	const intl = useIntl();

	const defaultTTLValues = [1, 7, 30, 90];

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

				{ prefs.downloadMode === 'on-demand' && <div className="setting-ttl-box">
					<input
						id={ 'ttl-' + id }
						type="checkbox"
						checked={ prefs.ttlEnabled }
						disabled={ !prefs.sync }
						onChange={ onChangeTTLEnabled }
					/>
					<label htmlFor={ 'ttl-' + id }>
						{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.remove' }) }
					</label>
					<select
						value={ prefs.ttlValue }
						disabled={ !prefs.sync || !prefs.ttlEnabled }
						className="setting-ttl-value"
						onChange={ onChangeTTLValue }
					>
						{ !defaultTTLValues.includes(prefs.ttlValue)
							&& <option value={ prefs.ttlValue }>
								{ Zotero.getString(
									'zotero.preferences.sync.fileSyncing.ttl.custom',
									prefs.ttlValue,
									prefs.ttlValue
								) }
							</option>
						}
						<option value="1">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.ttl.oneDay' }) }
						</option>
						<option value="7">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.ttl.oneWeek' }) }
						</option>
						<option value="30">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.ttl.oneMonth' }) }
						</option>
						<option value="90">
							{ intl.formatMessage({ id: 'zotero.preferences.sync.fileSyncing.ttl.threeMonths' }) }
						</option>
					</select>
				</div> }
			</div> }
		</div>
	);
};

Group.propTypes = {
	id: PropTypes.number,
	name: PropTypes.string,
	prefs: PropTypes.object,
	onChangeEnabled: PropTypes.func,
	onChangeSync: PropTypes.func,
	onChangeMode: PropTypes.func,
	onChangeTTLEnabled: PropTypes.func,
	onChangeTTLValue: PropTypes.func
};

const GroupCustomSettings = () => {
	const intl = useIntl();

	const [groups, setGroups] = useState([]);

	// Global settings
	// If the global setting is on-sync for downloadMode then we
	// might not have a set a TTL for global yet so we need default values
	const [globalPrefs, setGlobalPrefs] = useState({
		enabled: true,
		sync: Zotero.Prefs.get('sync.storage.groups.enabled'),
		downloadMode: Zotero.Prefs.get('sync.storage.downloadMode.groups'),
		ttlEnabled: Zotero.Prefs.get('sync.storage.groups.ttl') || false,
		ttlValue: Zotero.Prefs.get('sync.storage.groups.ttl.value') || 30
	});

	// Simply turn off custom settings for all groups
	const revertAllGroups = () => {
		const newGroups = groups.map((group) => {
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
			let groups = [];
			try {
				// Load up remote groups
				let keyInfo = await Zotero.Sync.Runner.checkAccess(client, { timeout: 5000 });
				groups = await client.getGroups(keyInfo.userID);
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
			groups.sort((a, b) => collation.compareString(1, a.data.name, b.data.name));

			// Put them into state
			setGroups(
				groups
					.filter(group => librariesToSkip.indexOf("G" + group.id) === -1)
					.map(group => ({
						name: group.data.name,
						id: group.id,
						prefs: customPreferences(group.id)
					}))
			);
		})();
	}, []);

	// Update the given pref and change the state
	const updatePrefInGroups = (id, pref, value) => {
		if (id) {
			const newGroups = groups.map((group) => {
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
		}
		else {
			Zotero.Prefs.set('sync.storage.downloadMode.groups', event.target.value);
		}
		updatePrefInGroups(id, 'downloadMode', event.target.value);
	};

	const handleChangeTTLEnabled = (event, id) => {
		if (id) {
			Zotero.Prefs.set('sync.storage.groups.' + id + '.ttl', event.target.checked);
		}
		else {
			Zotero.Prefs.set('sync.storage.groups.ttl', event.target.checked);
		}
		updatePrefInGroups(id, 'ttlEnabled', event.target.checked);
	};

	const handleChangeTTLValue = (event, id) => {
		if (id) {
			Zotero.Prefs.set('sync.storage.groups.' + id + '.ttl.value', parseInt(event.target.value));
		}
		else {
			Zotero.Prefs.set('sync.storage.groups.ttl.value', parseInt(event.target.value));
		}
		updatePrefInGroups(id, 'ttlValue', parseInt(event.target.value));
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
					onChangeTTLEnabled={ event => handleChangeTTLEnabled(event, false) }
					onChangeTTLValue={ event => handleChangeTTLValue(event, false) }
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
							onChangeEnabled={ event => handleChangeEnabled(event, group.id) }
							onChangeSync={ event => handleChangeSync(event, group.id) }
							onChangeMode={ event => handleChangeMode(event, group.id) }
							onChangeTTLEnabled={ event => handleChangeTTLEnabled(event, group.id) }
							onChangeTTLValue={ event => handleChangeTTLValue(event, group.id) }
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
