/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
                     Falls Church, Virginia, USA
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

ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

const FILE_NAME = 'treePrefs.json';

// Settings for all trees, shared by every window in the process
let _settings = null;
// Read-modify-write runs one caller at a time
let _queue = Promise.resolve();

function _enqueue(run) {
	let promise = _queue.then(run, run);
	_queue = promise.catch(() => {});
	return promise;
}

function getPath() {
	return PathUtils.join(Zotero.Profile.dir, FILE_NAME);
}

async function load() {
	if (!_settings) {
		try {
			_settings = JSON.parse(await Zotero.File.getContentsAsync(getPath()));
		}
		catch {
			_settings = null;
		}
		if (!_settings || typeof _settings != 'object' || Array.isArray(_settings)) {
			_settings = {};
		}
	}
	return _settings;
}

/**
 * Settings persisted by item trees, stored in a single file in the profile directory and
 * keyed by tree id
 */
export var TreePrefs = {

	/**
	 * @param {String} id - Tree id
	 * @return {Promise<Object>}
	 */
	async get(id) {
		let settings;
		await this._withSettings((all) => {
			settings = structuredClone(all[id] || {});
		});
		return settings;
	},

	/**
	 * @param {String} id - Tree id
	 * @param {Object} prefs
	 * @return {Promise}
	 */
	set(id, prefs) {
		return this._updateSettings((all) => {
			all[id] = structuredClone(prefs);
		});
	},

	/**
	 * Run a function with the settings for all trees, one caller at a time
	 *
	 * @param {Function} fn - Passed the settings object for all trees
	 * @return {Promise}
	 */
	_withSettings(fn) {
		return _enqueue(async () => {
			await fn(await load());
		});
	},

	/**
	 * Run a function that modifies the settings for all trees, one caller at a time, and
	 * write the file back out, unless the function returns false
	 *
	 * @param {Function} fn - Passed the settings object for all trees
	 * @return {Promise}
	 */
	_updateSettings(fn) {
		return _enqueue(async () => {
			let settings = await load();
			if (await fn(settings) !== false) {
				await Zotero.File.putContentsAsync(getPath(), JSON.stringify(settings));
			}
		});
	}
};
