/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
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

Zotero.Dictionaries = new function () {
	let _dictionaries = [];
	let _spellChecker = Cc['@mozilla.org/spellchecker/engine;1']
		.getService(Ci.mozISpellCheckingEngine);
	_spellChecker.QueryInterface(Ci.mozISpellCheckingEngine);

	Zotero.defineProperty(this, 'baseURL', {
		get: () => {
			let url = ZOTERO_CONFIG.DICTIONARIES_URL;
			if (!url.endsWith('/')) {
				url += '/';
			}
			return url;
		}
	});
	
	Zotero.defineProperty(this, 'dictionaries', {
		get: () => {
			return _dictionaries;
		}
	});

	/**
	 * Load all dictionaries
	 *
	 * @return {Promise}
	 */
	this.init = async function () {
		let dictionariesDir = OS.Path.join(Zotero.Profile.dir, 'dictionaries');
		if (!(await OS.File.exists(dictionariesDir))) {
			return;
		}
		let iterator = new OS.File.DirectoryIterator(dictionariesDir);
		try {
			await iterator.forEach(async function (entry) {
				if (entry.name.startsWith('.')) {
					return;
				}
				try {
					let dir = OS.Path.join(dictionariesDir, entry.name);
					await _loadDictionary(dir);
				}
				catch (e) {
					Zotero.logError(e);
				}
			});
		}
		finally {
			iterator.close();
		}
	};

	/**
	 * Get available dictionaries from server
	 *
	 * @return {Promise<Object>}
	 */
	this.fetchDictionariesList = async function () {
		let url = this.baseURL + 'dictionaries.json';
		let req = await Zotero.HTTP.request('GET', url, { responseType: 'json' });
		return req.response;
	};

	/**
	 * Install the most popular dictionary for specified locale
	 *
	 * @param locale
	 * @return {Promise<Boolean>}
	 */
	this.installByLocale = async function (locale) {
		let dictionaries = await this.fetchDictionariesList();
		let matched = dictionaries.filter(x => x.locale === locale);
		if (!matched.length) {
			matched = dictionaries.filter(x => x.locale === locale.split(/[-_]/)[0]);
		}
		if (!matched.length) {
			return false;
		}
		matched.sort((a, b) => b.users - a.users);
		await this.install(matched[0].id);
		return true;
	};

	/**
	 * Remove all dictionaries targeting specific locale
	 *
	 * @param locale
	 * @return {Promise}
	 */
	this.removeByLocale = async function(locale) {
		for (let dictionary of _dictionaries) {
			if (dictionary.locales.includes(locale)
			|| dictionary.locales.some(x => x === locale.split(/[-_]/)[0])) {
				await this.remove(dictionary.id);
			}
		}
	};

	/**
	 * Install dictionary by extension id,
	 * e.g., `en-NZ@dictionaries.addons.mozilla.org`
	 *
	 * @param {String} id - Dictionary extension id
	 * @return {Promise}
	 */
	this.install = async function (id) {
		await this.remove(id);
		let url = this.baseURL + id + '.xpi';
		let xpiPath = OS.Path.join(Zotero.getTempDirectory().path, id);
		let dir = OS.Path.join(Zotero.Profile.dir, 'dictionaries', id);
		let zipReader = Components.classes['@mozilla.org/libjar/zip-reader;1']
			.createInstance(Components.interfaces.nsIZipReader);
		try {
			await Zotero.File.download(url, xpiPath);

			zipReader.open(Zotero.File.pathToFile(xpiPath));
			zipReader.test(null);

			// Create directories
			let entries = zipReader.findEntries('*/');
			while (entries.hasMore()) {
				let entry = entries.getNext();
				let destPath = OS.Path.join(dir, entry);
				await Zotero.File.createDirectoryIfMissingAsync(destPath, { from: Zotero.Profile.dir });
			}

			// Extract files
			entries = zipReader.findEntries('*');
			while (entries.hasMore()) {
				let entry = entries.getNext();
				if (entry.substr(-1) === '/') {
					continue;
				}
				let destPath = OS.Path.join(dir, entry);
				zipReader.extract(entry, Zotero.File.pathToFile(destPath));
			}

			zipReader.close();
			await OS.File.remove(xpiPath);
			await _loadDictionary(dir);
		}
		catch (e) {
			if (await OS.File.exists(xpiPath)) {
				await OS.File.remove(xpiPath);
			}
			if (await OS.File.exists(dir)) {
				await OS.File.removeDir(dir);
			}
			throw e;
		}
	};

	/**
	 * Remove dictionary by extension id
	 *
	 * @param {String} id
	 * @return {Promise}
	 */
	this.remove = async function (id) {
		let dictionaryIndex = _dictionaries.findIndex(x => x.id === id);
		if (dictionaryIndex !== -1) {
			let dictionary = _dictionaries[dictionaryIndex];
			try {
				let manifestPath = OS.Path.join(dictionary.dir, 'manifest.json');
				let manifest = await Zotero.File.getContentsAsync(manifestPath);
				manifest = JSON.parse(manifest);
				for (let locale in manifest.dictionaries) {
					let dicPath = manifest.dictionaries[locale];
					let affPath = OS.Path.join(dictionary.dir, dicPath.slice(0, -3) + 'aff');
					_spellChecker.removeDictionary(locale, Zotero.File.pathToFile(affPath));
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			await OS.File.removeDir(dictionary.dir);
			_dictionaries.splice(dictionaryIndex, 1);
		}
	};

	/**
	 * Update all dictionaries
	 *
	 * @return {Promise}
	 */
	this.update = async function () {
		let availableDictionaries = await this.fetchDictionariesList();
		for (let dictionary of _dictionaries) {
			let availableDictionary = availableDictionaries.find(x => x.id === dictionary.id);
			if (availableDictionary && availableDictionary.version > dictionary.version) {
				await this.install(availableDictionary.id);
			}
		}
	};

	/**
	 * Load dictionary from specified dir
	 *
	 * @param {String} dir
	 * @return {Promise}
	 */
	async function _loadDictionary(dir) {
		let manifestPath = OS.Path.join(dir, 'manifest.json');
		let manifest = await Zotero.File.getContentsAsync(manifestPath);
		manifest = JSON.parse(manifest);
		let id;
		if (manifest.applications && manifest.applications.gecko) {
			id = manifest.applications.gecko.id;
		}
		else {
			id = manifest.browser_specific_settings.gecko.id;
		}
		let version = manifest.version;
		let locales = [];
		for (let locale in manifest.dictionaries) {
			locales.push(locale);
			let dicPath = manifest.dictionaries[locale];
			let affPath = OS.Path.join(dir, dicPath.slice(0, -3) + 'aff');
			_spellChecker.addDictionary(locale, Zotero.File.pathToFile(affPath));
		}
		_dictionaries.push({ id, locales, version, dir });
	}
};
