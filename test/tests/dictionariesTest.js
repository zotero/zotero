"use strict";

var sandbox = sinon.createSandbox();

describe("Dictionaries", function () {
	var win;
	var enUKXPIOld, frFRv1XPI, unKNXPI, enUKXPINew, frFRv2XPI;
	
	async function makeFakeDictionary({ id, locale, version }) {
		var dir = await getTempDirectory();
		var extDir = OS.Path.join(dir, 'sub');
		var dictDir = OS.Path.join(extDir, 'dictionaries');
		await OS.File.makeDir(dictDir, { from: dir });
		var manifest = {
			dictionaries: {
				[locale]: `dictionaries/${locale}.dic`,
			},
			version,
			applications: {
				gecko: {
					id
				}
			},
			name,
			manifest_version: 2
		};
		await Zotero.File.putContentsAsync(
			OS.Path.join(extDir, 'manifest.json'),
			JSON.stringify(manifest)
		);
		await Zotero.File.putContentsAsync(
			OS.Path.join(dictDir, locale + '.dic'),
			"1\n0/nm"
		);
		var path = OS.Path.join(dir, id + '.xpi');
		await Zotero.File.zipDirectory(extDir, path);
		return path;
	}
	
	before(async function () {
		// Make fake installed dictionaries
		enUKXPIOld = await makeFakeDictionary({
			id: '@fake-en-UK-dictionary',
			locale: 'en-UK',
			version: 5,
			name: "Fake English UK Dictionary"
		});
		frFRv1XPI = await makeFakeDictionary({
			id: '@fake-fr-FR-dictionary',
			locale: 'fr-FR',
			version: 1,
			name: "Fake French Dictionary"
		});
		unKNXPI = await makeFakeDictionary({
			id: '@fake-unknown-dictionary',
			locale: 'xx-UN',
			version: 5,
			name: "Fake Unknown Dictionary"
		});
		// Make fake updated dictionaries
		enUKXPINew = await makeFakeDictionary({
			id: '@another-fake-en-UK-dictionary',
			locale: 'en-UK',
			version: 1,
			name: "Another Fake English UK Dictionary"
		});
		frFRv2XPI = await makeFakeDictionary({
			id: '@fake-fr-FR-dictionary',
			locale: 'fr-FR',
			version: 2,
			name: "Fake French Dictionary"
		});
	});
	
	beforeEach(async function () {
		for (let id of Zotero.Dictionaries.dictionaries.map(x => x.id)) {
			await Zotero.Dictionaries.remove(id);
		}
		
		sandbox.stub(Zotero.File, 'download').callsFake(async (url, downloadPath) => {
			Zotero.debug("Fake downloading " + url);
			if (url.includes('en-UK')) {
				return OS.File.copy(enUKXPIOld, downloadPath);
			}
			if (url.includes('fr-FR')) {
				return OS.File.copy(frFRv1XPI, downloadPath);
			}
			if (url.includes('xx-UN')) {
				return OS.File.copy(unKNXPI, downloadPath);
			}
			throw new Error("Unexpected URL " + url);
		});
		await Zotero.Dictionaries.install('@fake-en-UK-dictionary', "5");
		await Zotero.Dictionaries.install('@fake-fr-FR-dictionary', "1");
		await Zotero.Dictionaries.install('@fake-xx-UN-dictionary', "5");
		sandbox.restore();
		
		// Create metadata response for available dictionaries
		sandbox.stub(Zotero.Dictionaries, 'fetchDictionariesList')
			.resolves([
				{
					id: '@another-fake-en-UK-dictionary',
					locale: 'en-UK',
					name: "English (UK)",
					version: 1
				},
				{
					id: '@fake-fr-FR-dictionary',
					locale: 'fr-FR',
					name: "Français",
					version: 2
				}
			]);
		
		sandbox.stub(Zotero.File, 'download').callsFake(async (url, downloadPath) => {
			Zotero.debug("Fake downloading " + url);
			if (url.includes('en-UK') && url.includes("-1.xpi")) {
				return OS.File.copy(enUKXPINew, downloadPath);
			}
			if (url.includes('fr-FR') && url.includes("-2.xpi")) {
				return OS.File.copy(frFRv2XPI, downloadPath);
			}
			throw new Error("Unexpected URL " + url);
		});
	});
	
	afterEach(function () {
		sandbox.restore();
	});
	
	describe("Zotero.Dictionaries", function () {
		describe("#update()", function () {
			it("should update outdated dictionary and replace an installed dictionary with a new one with a different id", async function () {
				var numDictionaries = Zotero.Dictionaries.dictionaries.length;
				function updated() {
					return !!(
						!Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-en-UK-dictionary')
							&& Zotero.Dictionaries.dictionaries.find(x => x.id == '@another-fake-en-UK-dictionary')
							// Version update happens too
							&& !Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-fr-FR-dictionary' && x.version == 1)
							&& Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-fr-FR-dictionary' && x.version == 2)
					);
				}
				assert.isFalse(updated());
				await Zotero.Dictionaries.update();
				assert.isTrue(updated());
				assert.lengthOf(Zotero.Dictionaries.dictionaries, numDictionaries);
			});
		});
	});
	
	describe("Dictionary Manager", function () {
		beforeEach(async function () {
			win = Services.ww.openWindow(
				null,
				'chrome://zotero/content/dictionaryManager.xul',
				'dictionary-manager',
				'chrome,centerscreen',
				{}
			);
			while (!win.document.querySelectorAll('input[type="checkbox"]').length) {
				await Zotero.Promise.delay(50);
			}
		});
		
		afterEach(function () {
			win.close();
		});
		
		it("should show unknown dictionary as installed", async function () {
			var elems = win.document.querySelectorAll('input[type="checkbox"]');
			var names = [...elems].map(elem => elem.dataset.dictName);
			assert.sameMembers(names, ['English (UK)', 'Français', 'xx (UN)']);
		});
		
		it("should update outdated dictionary and replace an installed dictionary with a new one with a different id", async function () {
			var numDictionaries = Zotero.Dictionaries.dictionaries.length;
			function updated() {
				return !!(
					!Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-en-UK-dictionary')
						&& Zotero.Dictionaries.dictionaries.find(x => x.id == '@another-fake-en-UK-dictionary')
						// Version update happens too
						&& !Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-fr-FR-dictionary' && x.version == 1)
						&& Zotero.Dictionaries.dictionaries.find(x => x.id == '@fake-fr-FR-dictionary' && x.version == 2)
				);
			}
			assert.isFalse(updated());
			win.document.querySelector('button[dlgtype="accept"]').click();
			while (!updated()) {
				await Zotero.Promise.delay(50);
			}
			assert.lengthOf(Zotero.Dictionaries.dictionaries, numDictionaries);
		});
	});
});
