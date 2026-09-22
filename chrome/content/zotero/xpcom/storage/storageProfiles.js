/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright (c) 2026

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


if (!Zotero.Sync.Storage) {
	Zotero.Sync.Storage = {};
}

/**
 * Local storage profile routing.
 *
 * Profiles are stored in prefs so the sync runner can resolve a library's file-sync backend
 * synchronously. Passwords are stored separately by the WebDAV controller in the login manager.
 */
Zotero.Sync.Storage.Profiles = {
	_profilesPref: 'sync.storage.webdavProfiles',
	_libraryProfilesPref: 'sync.storage.libraryProfiles',
	_reservedProfileIDs: new Set(['__proto__', 'prototype', 'constructor']),

	_getPrefObject(pref) {
		let object = Object.create(null);
		let value = Zotero.Prefs.get(pref);
		if (!value) {
			return object;
		}
		try {
			let parsed = JSON.parse(value);
			if (!parsed || typeof parsed != 'object' || Array.isArray(parsed)) {
				return object;
			}
			for (let [key, val] of Object.entries(parsed)) {
				object[key] = val;
			}
			return object;
		}
		catch (e) {
			Zotero.logError(e);
			return object;
		}
	},

	_setPrefObject(pref, value) {
		Zotero.Prefs.set(pref, JSON.stringify(value));
	},

	_hasOwn(object, key) {
		return Object.prototype.hasOwnProperty.call(object, key);
	},

	_normalizeProfileID(profileID) {
		if (profileID === undefined || profileID === null) {
			throw new Error("profileID not provided");
		}
		profileID = `${profileID}`.trim();
		if (!profileID) {
			throw new Error("profileID cannot be empty");
		}
		if (!/^[A-Za-z0-9._-]+$/.test(profileID)) {
			throw new Error("profileID can contain only letters, numbers, '.', '_', and '-'");
		}
		if (this._reservedProfileIDs.has(profileID)) {
			throw new Error(`profileID '${profileID}' is reserved`);
		}
		return profileID;
	},

	_normalizeURL(url) {
		return `${url || ''}`.trim()
			// Match the existing sync preferences behavior
			.replace(/(^https?:\/\/|^:?\/\/|\/zotero\/?$|\/$)/g, '');
	},

	_getLibraryProfileKey(libraryID) {
		let library = Zotero.Libraries.get(libraryID);
		switch (library.libraryType) {
		case 'user':
			return `L${library.libraryID}`;

		case 'group':
			return `G${Zotero.Groups.getGroupIDFromLibraryID(libraryID)}`;

		case 'publications':
			return `P${library.libraryID}`;

		default:
			return `${library.libraryType}:${library.libraryID}`;
		}
	},

	_getLibraryIDFromProfileKey(key) {
		let type = key[0];
		let id = parseInt(key.substr(1), 10);
		if (!id) {
			return false;
		}

		if (type == 'G') {
			return Zotero.Groups.getLibraryIDFromGroupID(id);
		}

		if ((type == 'L' || type == 'P') && Zotero.Libraries.exists(id)) {
			return id;
		}

		return false;
	},

	_getWebDAVRoot(profile) {
		if (!profile || !profile.url) {
			return null;
		}
		return `${profile.scheme || 'https'}://${this._normalizeURL(profile.url)}`;
	},

	_getActiveGlobalWebDAVRoot() {
		if (!Zotero.Prefs.get('sync.storage.enabled')
				|| Zotero.Prefs.get('sync.storage.protocol') != 'webdav'
				|| this.getLibraryProfileID(Zotero.Libraries.userLibraryID)) {
			return null;
		}

		let url = this._normalizeURL(Zotero.Prefs.get('sync.storage.url'));
		if (!url) {
			return null;
		}
		return `${Zotero.Prefs.get('sync.storage.scheme') || 'https'}://${url}`;
	},

	_getAssignedLibraryIDsForProfile(profileID, assignments = null) {
		profileID = this._normalizeProfileID(profileID);
		assignments = assignments || this._getPrefObject(this._libraryProfilesPref);

		let libraryIDs = [];
		for (let [key, assignedProfileID] of Object.entries(assignments)) {
			if (assignedProfileID != profileID) {
				continue;
			}
			let libraryID = this._getLibraryIDFromProfileKey(key);
			if (libraryID) {
				libraryIDs.push(libraryID);
			}
		}
		return libraryIDs;
	},

	_assertWebDAVRootAssignableToLibrary(profileID, libraryID, profile = null) {
		profile = profile || this.getWebDAVProfile(profileID);
		let root = this._getWebDAVRoot(profile);
		if (!root) {
			return;
		}

		let assignments = this._getPrefObject(this._libraryProfilesPref);
		let libraryKey = this._getLibraryProfileKey(libraryID);
		for (let [key, assignedProfileID] of Object.entries(assignments)) {
			if (key == libraryKey) {
				continue;
			}
			let assignedProfile = this.getWebDAVProfile(assignedProfileID);
			if (this._getWebDAVRoot(assignedProfile) == root) {
				throw new Error(
					`WebDAV profile '${profileID}' uses the same WebDAV URL as profile `
					+ `'${assignedProfileID}' assigned to another library`
				);
			}
		}

		if (libraryID != Zotero.Libraries.userLibraryID
				&& this._getActiveGlobalWebDAVRoot() == root) {
			throw new Error(
				`WebDAV profile '${profileID}' uses the same WebDAV URL as the global WebDAV `
				+ `file-sync settings`
			);
		}
	},

	_assertAssignedWebDAVRootIsUnique(profileID, profile) {
		for (let libraryID of this._getAssignedLibraryIDsForProfile(profileID)) {
			this._assertWebDAVRootAssignableToLibrary(profileID, libraryID, profile);
		}
	},

	async _resetSyncStatesForAssignedLibraries(profileID, assignments = null) {
		for (let libraryID of this._getAssignedLibraryIDsForProfile(profileID, assignments)) {
			await Zotero.Sync.Storage.Local.resetAllSyncStates(libraryID);
		}
	},

	getWebDAVProfiles() {
		return this._getPrefObject(this._profilesPref);
	},

	getWebDAVProfile(profileID) {
		profileID = this._normalizeProfileID(profileID);
		let profiles = this.getWebDAVProfiles();
		if (!this._hasOwn(profiles, profileID)
				|| !profiles[profileID]
				|| typeof profiles[profileID] != 'object') {
			return null;
		}
		let profile = profiles[profileID];
		return profile ? Object.assign({ id: profileID, type: 'webdav' }, profile) : null;
	},

	setWebDAVProfileVerified(profileID, verified) {
		profileID = this._normalizeProfileID(profileID);
		let profiles = this.getWebDAVProfiles();
		if (!this._hasOwn(profiles, profileID)) {
			throw new Error(`WebDAV profile '${profileID}' not found`);
		}
		profiles[profileID].verified = !!verified;
		this._setPrefObject(this._profilesPref, profiles);
	},

	async setWebDAVProfile(profileID, options) {
		profileID = this._normalizeProfileID(profileID);
		if (!options) {
			throw new Error("WebDAV profile options not provided");
		}

		let profiles = this.getWebDAVProfiles();
		let existing = this._hasOwn(profiles, profileID) && typeof profiles[profileID] == 'object'
			? profiles[profileID]
			: {};
		let profile = Object.assign({}, existing);

		if (options.scheme !== undefined) {
			if (!['http', 'https'].includes(options.scheme)) {
				throw new Error(`Invalid WebDAV scheme '${options.scheme}'`);
			}
			profile.scheme = options.scheme;
		}
		if (options.url !== undefined) {
			profile.url = this._normalizeURL(options.url);
		}
		if (options.username !== undefined) {
			profile.username = `${options.username || ''}`;
		}

		profile.type = 'webdav';
		profile.scheme = profile.scheme || 'https';
		profile.url = profile.url || '';
		profile.username = profile.username || '';

		let connectionChanged = existing.scheme != profile.scheme
			|| existing.url != profile.url
			|| existing.username != profile.username;
		profile.verified = options.verified !== undefined
			? !!options.verified
			: (connectionChanged ? false : !!existing.verified);

		this._assertAssignedWebDAVRootIsUnique(profileID, profile);

		profiles[profileID] = profile;
		this._setPrefObject(this._profilesPref, profiles);

		if (options.password !== undefined) {
			let controller = new Zotero.Sync.Storage.Mode.WebDAV({ profileID });
			await controller.setPassword(options.password);
			profile.verified = false;
			profiles[profileID] = profile;
			this._setPrefObject(this._profilesPref, profiles);
		}

		if (connectionChanged && options.resetSyncState !== false) {
			await this._resetSyncStatesForAssignedLibraries(profileID);
		}

		if (Zotero.Sync.Runner) {
			Zotero.Sync.Runner.resetStorageController('webdav', { profileID });
		}

		return this.getWebDAVProfile(profileID);
	},

	async removeWebDAVProfile(profileID, options = {}) {
		profileID = this._normalizeProfileID(profileID);
		let controller = new Zotero.Sync.Storage.Mode.WebDAV({ profileID });
		await controller.clearPassword();

		let profiles = this.getWebDAVProfiles();
		delete profiles[profileID];
		this._setPrefObject(this._profilesPref, profiles);

		let assignments = this._getPrefObject(this._libraryProfilesPref);
		let originalAssignments = this._getPrefObject(this._libraryProfilesPref);
		for (let key in assignments) {
			if (assignments[key] == profileID) {
				delete assignments[key];
			}
		}
		this._setPrefObject(this._libraryProfilesPref, assignments);

		if (options.resetSyncState !== false) {
			await this._resetSyncStatesForAssignedLibraries(profileID, originalAssignments);
		}

		if (Zotero.Sync.Runner) {
			Zotero.Sync.Runner.resetStorageController('webdav', { profileID });
		}
	},

	getLibraryProfileID(libraryID) {
		let assignments = this._getPrefObject(this._libraryProfilesPref);
		return assignments[this._getLibraryProfileKey(libraryID)] || null;
	},

	getWebDAVProfileForLibrary(libraryID) {
		let profileID = this.getLibraryProfileID(libraryID);
		return profileID ? this.getWebDAVProfile(profileID) : null;
	},

	isProfileAssignedToAnotherLibrary(profileID, libraryID) {
		profileID = this._normalizeProfileID(profileID);
		let libraryKey = this._getLibraryProfileKey(libraryID);
		let assignments = this._getPrefObject(this._libraryProfilesPref);
		return Object.entries(assignments)
			.some(([key, assignedProfileID]) => key != libraryKey && assignedProfileID == profileID);
	},

	canSaveFilesForLibrary(libraryID) {
		let library = Zotero.Libraries.get(libraryID);
		if (!library.editable) {
			return false;
		}
		if (library.filesEditable) {
			return true;
		}

		// A group with normal item-editing rights can save local attachments when its file
		// backend is a per-library WebDAV profile, even if Zotero Storage file editing is off.
		return !!this.getWebDAVProfileForLibrary(libraryID);
	},

	async setLibraryProfile(libraryID, profileID, options = {}) {
		let library = Zotero.Libraries.get(libraryID);
		if (!['user', 'group'].includes(library.libraryType)) {
			throw new Error(`Cannot set storage profile for ${library.libraryType} library`);
		}

		profileID = this._normalizeProfileID(profileID);
		if (!this.getWebDAVProfile(profileID)) {
			throw new Error(`WebDAV profile '${profileID}' does not exist`);
		}

		let assignments = this._getPrefObject(this._libraryProfilesPref);
		let libraryKey = this._getLibraryProfileKey(libraryID);
		for (let key in assignments) {
			if (key != libraryKey && assignments[key] == profileID) {
				throw new Error(`WebDAV profile '${profileID}' is already assigned to another library`);
			}
		}
		this._assertWebDAVRootAssignableToLibrary(profileID, libraryID);
		assignments[libraryKey] = profileID;
		this._setPrefObject(this._libraryProfilesPref, assignments);

		if (options.resetSyncState !== false) {
			await Zotero.Sync.Storage.Local.resetAllSyncStates(libraryID);
		}

		if (Zotero.Sync.Runner) {
			Zotero.Sync.Runner.resetStorageController('webdav', { profileID });
		}
	},

	async clearLibraryProfile(libraryID, options = {}) {
		let assignments = this._getPrefObject(this._libraryProfilesPref);
		let key = this._getLibraryProfileKey(libraryID);
		if (!assignments[key]) {
			return false;
		}
		let profileID = assignments[key];
		delete assignments[key];
		this._setPrefObject(this._libraryProfilesPref, assignments);

		if (options.resetSyncState !== false) {
			await Zotero.Sync.Storage.Local.resetAllSyncStates(libraryID);
		}

		if (Zotero.Sync.Runner) {
			Zotero.Sync.Runner.resetStorageController('webdav', { profileID });
		}
		return true;
	},

	clearLibraryProfileByKey(libraryProfileKey) {
		let assignments = this._getPrefObject(this._libraryProfilesPref);
		if (assignments[libraryProfileKey]) {
			delete assignments[libraryProfileKey];
			this._setPrefObject(this._libraryProfilesPref, assignments);
		}
	},

	getModeForLibrary(libraryID) {
		let profile = this.getWebDAVProfileForLibrary(libraryID);
		return profile ? 'webdav' : null;
	},

	getControllerKey(mode, options = {}) {
		if (mode != 'webdav') {
			return mode;
		}
		let profileID = options.profileID;
		if (!profileID && options.libraryID !== undefined) {
			profileID = this.getLibraryProfileID(options.libraryID);
		}
		return profileID ? `${mode}:profile:${profileID}` : `${mode}:global`;
	},

	getLoginManagerRealm(profileID) {
		if (!profileID) {
			return null;
		}
		profileID = this._normalizeProfileID(profileID);
		return `Zotero Storage Server (profile: ${profileID})`;
	},

	/**
	 * Convenience API for Run JavaScript/startup scripts.
	 */
	async verifyWebDAVProfile(profileID, options = {}) {
		profileID = this._normalizeProfileID(profileID);
		let controller = new Zotero.Sync.Storage.Mode.WebDAV({ profileID });
		await controller.checkServer(options);
		return controller.verified;
	},

	async configureWebDAVForLibrary(libraryID, profileID, options) {
		await this.setWebDAVProfile(profileID, options);
		await this.setLibraryProfile(libraryID, profileID);
	}
};
