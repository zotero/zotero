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
	
	// Note: Doesn't include bundled en-US
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
					await _loadDirectory(dir);
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
	 * Install dictionary by extension id,
	 * e.g., `en-NZ@dictionaries.addons.mozilla.org`
	 *
	 * @param {String} id - Dictionary extension id
	 * @param {String} version - Dictionary extension version
	 * @return {Promise}
	 */
	this.install = async function (id, version) {
		if (id == '@unitedstatesenglishdictionary') {
			throw new Error("en-US dictionary is bundled");
		}
		if (!version) {
			throw new Error("Version not provided");
		}
		await this.remove(id);
		Zotero.debug("Installing dictionaries from " + id);
		let url = this.baseURL + id + '-' + version + '.xpi';
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
				let destPath = OS.Path.join(dir, ...entry.split(/\//));
				await Zotero.File.createDirectoryIfMissingAsync(destPath, { from: Zotero.Profile.dir });
			}

			// Extract files
			entries = zipReader.findEntries('*');
			while (entries.hasMore()) {
				let entry = entries.getNext();
				if (entry.substr(-1) === '/') {
					continue;
				}
				Zotero.debug("Extracting " + entry);
				let destPath = OS.Path.join(dir, ...entry.split(/\//));
				zipReader.extract(entry, Zotero.File.pathToFile(destPath));
			}

			zipReader.close();
			await OS.File.remove(xpiPath);
			await _loadDirectory(dir);
		}
		catch (e) {
			try {
				if (await OS.File.exists(xpiPath)) {
					await OS.File.remove(xpiPath);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			try {
				if (await OS.File.exists(dir)) {
					await OS.File.removeDir(dir);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			throw e;
		}
	};

	/**
	 * Remove dictionaries by extension id
	 *
	 * @param {String} id
	 * @return {Promise}
	 */
	this.remove = async function (id) {
		Zotero.debug("Removing dictionaries from " + id);
		var dictionary = _dictionaries.find(x => x.id === id);
		if (!dictionary) {
			return;
		}
		try {
			let manifestPath = OS.Path.join(dictionary.dir, 'manifest.json');
			let manifest = await Zotero.File.getContentsAsync(manifestPath);
			manifest = JSON.parse(manifest);
			for (let locale in manifest.dictionaries) {
				let dicPath = manifest.dictionaries[locale];
				let affPath = OS.Path.join(dictionary.dir, ...dicPath.split(/\//)).slice(0, -3) + 'aff';
				Zotero.debug(`Removing ${locale} dictionary`);
				_spellChecker.removeDictionary(locale, Zotero.File.pathToFile(affPath));
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		await OS.File.removeDir(dictionary.dir);
		// Technically there can be more than one dictionary provided by the same extension id,
		// so remove all that match
		_dictionaries = _dictionaries.filter(x => x.id != id);
	};
	
	/**
	 * @param {Object[]} [dictionaries] - Dictionary list from fetchDictionariesList(); fetched
	 *     automatically if not provided
	 * @return {Object[]} - Array of objects with 'old' and 'new'
	 */
	this.getAvailableUpdates = async function (dictionaries) {
		var updates = [];
		let availableDictionaries = dictionaries || await this.fetchDictionariesList();
		for (let dictionary of _dictionaries) {
			let availableDictionary = availableDictionaries.find((x) => {
				return x.id === dictionary.id || x.locale == dictionary.locale;
			});
			if (!availableDictionary) continue;
			// If same id, check if version is higher
			if (availableDictionary.id == dictionary.id) {
				if (Services.vc.compare(dictionary.version, availableDictionary.version) < 0) {
					updates.push({ old: dictionary, new: availableDictionary });
				}
			}
			// If different id for same locale, always offer as an update
			else {
				updates.push({ old: dictionary, new: availableDictionary });
			}
		}
		if (updates.length) {
			Zotero.debug("Available dictionary updates:");
			Zotero.debug(updates);
		}
		else {
			Zotero.debug("No dictionary updates found");
		}
		return updates;
	};
	
	/**
	 * Get the best display name for a dictionary
	 *
	 * For known locales, this will be the native name in the target locale. If a native name isn't
	 * available and inlineSpellChecker is provided, an English name will be provided if available.
	 *
	 * @param {String} locale
	 * @param {InlineSpellChecker} [inlineSpellChecker] - An instance of InlineSpellChecker from
	 *     InlineSpellChecker.jsm
	 * @return {String} - The best available name, or the locale code if unavailable
	 */
	this.getBestDictionaryName = function (locale, inlineSpellChecker) {
		var name = Zotero.Locale.availableLocales[locale];
		if (!name) {
			for (let key in Zotero.Locale.availableLocales) {
				if (key.split('-')[0] === locale) {
					name = Zotero.Locale.availableLocales[key];
				}
			}
		}
		if (!name && inlineSpellChecker) {
			name = inlineSpellChecker.getDictionaryDisplayName(locale)
		}
		return name || name;
	};
	
	/**
	 * Update dictionaries
	 *
	 * @return {Promise<Integer>} - Number of updated dictionaries
	 */
	this.update = async function () {
		var updates = await Zotero.Dictionaries.getAvailableUpdates();
		var updated = 0;
		for (let update of updates) {
			try {
				await this.remove(update.old.id);
				await this.install(update.new.id, update.new.version);
				updated++;
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		return updated;
	};

	/**
	 * Load dictionary from specified dir
	 *
	 * @param {String} dir
	 * @return {Promise}
	 */
	async function _loadDirectory(dir) {
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
			let affPath = OS.Path.join(dir, ...dicPath.split(/\//)).slice(0, -3) + 'aff';
			Zotero.debug(`Adding ${locale} dictionary`);
			_spellChecker.addDictionary(locale, Zotero.File.pathToFile(affPath));
			_dictionaries.push({ id, locale, version, dir });
		}
	}
};
