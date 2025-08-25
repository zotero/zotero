describe("Zotero.QuickCopy", function () {
	var quickCopyPref;
	var prefName = "export.quickCopy.setting";
	
	before(function* () {
		yield Zotero.QuickCopy.loadSiteSettings();
		Zotero.Prefs.clear(prefName);
		quickCopyPref = Zotero.Prefs.get(prefName);
		quickCopyPref = JSON.stringify(Zotero.QuickCopy.unserializeSetting(quickCopyPref));
	});
	
	afterEach(function () {
		Zotero.Prefs.clear(prefName);
	});
	
	// TODO: These should set site-specific prefs and test the actual response against it,
	// but that will need to wait for 5.0. For now, just make sure they don't fail.
	describe("#getFormatFromURL()", function () {
		it("should handle an HTTP URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com/'), quickCopyPref);
		})
		
		it("should handle an HTTPS URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('https://foo.com/'), quickCopyPref);
		})
		
		it("should handle a domain and path", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com/bar'), quickCopyPref);
		})
		
		it("should handle a local host", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo/'), quickCopyPref);
		})
		
		it("should handle a domain with a trailing period", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com.'), quickCopyPref);
		})
		
		it("should handle an about: URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('about:blank'), quickCopyPref);
		})
		
		it("should handle a chrome URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('chrome://zotero/content/foo.xul'), quickCopyPref);
		})
	})
	
	describe("#getContentFromItems()", function () {
		it("should generate BibTeX", async function () {
			var item = await createDataObject('item');
			var content = "";
			var worked = false;
			
			await Zotero.Translators.init();
			
			var translatorID = '9cb70025-a888-4a29-a210-93ec52da40d4'; // BibTeX
			var format = 'export=' + translatorID;
			Zotero.Prefs.set(prefName, format);
			// Translator code for selected format is loaded automatically, so wait for it
			var translator = Zotero.Translators.get(translatorID);
			while (!translator.code) {
				await Zotero.Promise.delay(50);
			}
			
			Zotero.QuickCopy.getContentFromItems(
				[item],
				format,
				(obj, w) => {
					content = obj.string;
					worked = w;
				}
			);
			assert.isTrue(worked);
			assert.isTrue(content.trim().startsWith('@'));
		});
	});
	
	it("should generate bibliography in default locale if Quick Copy locale not set", async function () {
		var item = createUnsavedDataObject('item', { itemType: 'webpage', title: 'Foo' });
		item.setField('date', '2020-03-11');
		await item.saveTx();
		var content = "";
		var worked = false;
		
		// Quick Copy locale not set
		Zotero.Prefs.clear('export.quickCopy.locale');
		// This shouldn't be used
		Zotero.Prefs.set('export.lastLocale', 'fr-FR');
		await Zotero.Styles.init();
		
		var format = 'bibliography=http://www.zotero.org/styles/apa';
		Zotero.Prefs.set(prefName, format);
		
		var { text, html } = Zotero.QuickCopy.getContentFromItems([item], format);
		Zotero.debug(text);
		Zotero.debug(html);
		assert.isTrue(text.startsWith('Foo'));
		assert.include(text, 'March');
		assert.isTrue(html.startsWith('<div'));
		assert.include(html, '<i>Foo</i>');
		assert.include(html, 'March');
	});

	it("should use correct punctuation in a Chinese style", async function () {
		let styleFile = getTestDataDirectory();
		styleFile.append('handbook-of-legal-citations-zh.csl');
		await Zotero.Styles.install({ file: styleFile }, '', true);
		
		let styleID = 'https://www.zotero-chinese.com/styles/法学引注手册（多语言，重复引用不省略）';
		let format = `bibliography=${styleID}`;

		Zotero.Prefs.set(prefName, format);
		
		let item = createUnsavedDataObject('item', {
			itemType: 'journalArticle',
			title: '新型数据财产的行为主义保护：基于财产权理论的分析'
		});
		item.setField('language', 'zh');
		await item.saveTx();
		
		// Copy citation, not bibliography
		let { text } = Zotero.QuickCopy.getContentFromItems([item], format, null, true);
		assert.equal(text, '《新型数据财产的行为主义保护：基于财产权理论的分析》。');
	});
})
