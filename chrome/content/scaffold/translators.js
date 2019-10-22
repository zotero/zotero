Components.utils.import("resource://gre/modules/osfile.jsm");

var Scaffold_Translators = {
	// Keep in sync with translator.js
	TRANSLATOR_TYPES: { import: 1, export: 2, web: 4, search: 8 },
	
	_provider: null,
	_translators: new Map(),
	_translatorFiles: new Map(),
	
	load: Zotero.serial(async function (reload, filenames) {
		if (this._translators.size && !reload) {
			Zotero.debug("Scaffold: Translators already loaded");
			return;
		}
		
		if (filenames) {
			
		}
		
		var t = new Date();
		var dir = this.getDirectory();
		var numLoaded = 0;
		var deletedTranslators = new Set(this._translatorFiles.keys());
		await Zotero.File.iterateDirectory(dir, async function (entry) {
			if (entry.isDir || entry.name.startsWith('.') || !entry.name.endsWith('.js')) {
				return;
			}
			
			deletedTranslators.delete(entry.name);
			
			try {
				let fmtime;
				if ('winLastWriteDate' in entry) {
					fmtime = entry.winLastWriteDate.getTime();
				}
				else {
					fmtime = (await OS.File.stat(entry.path)).lastModificationDate.getTime();
				}
				let translatorID = this._translatorFiles.get(entry.name);
				let loadFile = true;
				// If translator is already loaded, see if mtime has changed
				if (translatorID) {
					let mtime = this._translators.get(translatorID).mtime;
					if (mtime == fmtime) {
						loadFile = false;
					}
				}
				if (loadFile) {
					let translator = await Zotero.Translators.loadFromFile(entry.path);
					this._translators.set(
						translator.translatorID,
						{
							translator,
							filename: entry.name,
							mtime: fmtime,
						}
					);
					this._translatorFiles.set(entry.name, translator.translatorID);
					numLoaded++;
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}.bind(this));
		
		Zotero.debug(`Scaffold: Loaded ${numLoaded} ${Zotero.Utilities.pluralize(numLoaded, 'translator')} `
			+ `in ${new Date() - t} ms`);
		
		for (let filename of deletedTranslators) {
			let id = this._translatorFiles.get(filename);
			let translator = this._translators.get(id);
			this._translatorFiles.delete(filename);
			// Filename won't match if translator was renamed
			if (translator.filename == filename) {
				this._translators.delete(id);
			}
		}
	}),
	
	deleteByID: async function (translatorID) {
		var translator = this._translators.get(translatorID);
		if (!translator) {
			Zotero.debug("Scaffold: Can't delete missing translator");
			return;
		}
		await OS.File.delete(OS.Path.join(this.getDirectory(), translator.filename));
		this._translators.delete(translatorID);
		this._translatorFiles.delete(translator.filename);
	},
	
	getDirectory: function () {
		return Zotero.Prefs.get('scaffold.translatorsDir');
	},
	
	getProvider: function () {
		if (this._provider) {
			return this._provider;
		}
		this._provider = Zotero.Translators.makeTranslatorProvider({
			get: function (translatorID) {
				if (!this._translators.size) {
					throw new Error("Scaffold: Translators not loaded");
				}
				var translator = this._translators.get(translatorID);
				return translator ? translator.translator : false;
			}.bind(this),
			
			getAllForType: async function (type) {
				if (!this._translators.size) {
					await this.load();
				}
				return [...this._translators.values()]
					.map(x => x.translator)
					.filter(translator => translator.translatorType & this.TRANSLATOR_TYPES[type]);
			}.bind(this),
			
			getTranslatorsDirectory: function () {
				return this.getDirectory();
			}.bind(this),
			
			reinit: async function (options = {}) {
				return this.load(
					true,
					options.filenames
				);
			}.bind(this)
		});
		return this._provider;
	}
};