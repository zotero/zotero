describe("Zotero.QuickCopy", function () {
	let domain = "test.org";

	const DEFAULT_BIB = {
		mode: 'bibliography',
		id: 'http://www.zotero.org/styles/chicago-shortened-notes-bibliography',
		contentType: '',
		locale: ''
	};
	const DEFAULT_EXPORT = {
		mode: 'export',
		id: '14763d24-8ba0-45df-8f52-b8d1108e7ac9' // Zotero RDF
	};
	const DEFAULT_DRAG = 'bibliography';
	const APA_STYLE_ID = 'http://www.zotero.org/styles/apa';
	const BIBTEX_TRANSLATOR_ID = '9cb70025-a888-4a29-a210-93ec52da40d4'; // BibTeX

	before(async function () {
		await Zotero.QuickCopy.loadSiteSettings();
	});

	beforeEach(function () {
		Zotero.Prefs.set('export.quickCopy.bibliographySetting', JSON.stringify(DEFAULT_BIB));
		Zotero.Prefs.set('export.quickCopy.exportSetting', JSON.stringify(DEFAULT_EXPORT));
		Zotero.Prefs.set('export.quickCopy.preferredFormatOnDrag', DEFAULT_DRAG);
		Zotero.QuickCopy.lastActiveURL = null;
	});

	describe("#getFormat()", function () {
		async function setSiteSetting(rawFormat) {
			await Zotero.DB.queryAsync(
				"REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
				[domain, rawFormat]
			);
			await Zotero.QuickCopy.loadSiteSettings();
		}

		afterEach(async function () {
			await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite'");
			await Zotero.QuickCopy.loadSiteSettings();
		});

		it("should handle an HTTP URL", function () {
			let urls = [
				"http://foo.com/",
				"https://foo.com/",
				"http://foo.com/bar",
				"http://foo/",
				"http://foo.com",
				"about:blank",
				"chrome://zotero/content/foo.xul"
			];
			for (let url of urls) {
				Zotero.QuickCopy.lastActiveURL = url;
				assert.deepEqual(Zotero.QuickCopy.getFormat(), JSON.parse(Zotero.Prefs.get("export.quickCopy.bibliographySetting")));
			}
		});

		it("should prefer the longer-domain match when multiple site settings apply", async function () {
			// `test.org` matches anything ending in test.org;
			// `wiki.test.org` matches only that subdomain
			await Zotero.DB.queryAsync(
				"REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
				['test.org', JSON.stringify({
					bibliography: {
						id: 'http://www.zotero.org/styles/chicago-author-date',
						contentType: '',
						locale: ''
					},
					drag: 'bibliography'
				})]
			);
			await Zotero.DB.queryAsync(
				"REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
				['wiki.test.org', JSON.stringify({
					bibliography: { id: APA_STYLE_ID, contentType: '', locale: '' },
					drag: 'bibliography'
				})]
			);
			await Zotero.QuickCopy.loadSiteSettings();

			Zotero.QuickCopy.lastActiveURL = 'https://wiki.test.org/page';
			let bib = Zotero.QuickCopy.getFormat('bibliography');
			assert.equal(bib.id, APA_STYLE_ID);
		});

		it("should prefer the longer-path match when domains are equal", async function () {
			// Same domain, different paths
			await Zotero.DB.queryAsync(
				"REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
				['test.org', JSON.stringify({
					bibliography: {
						id: 'http://www.zotero.org/styles/chicago-author-date',
						contentType: '',
						locale: ''
					},
					drag: 'bibliography'
				})]
			);
			await Zotero.DB.queryAsync(
				"REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
				['test.org/styles/', JSON.stringify({
					bibliography: { id: APA_STYLE_ID, contentType: '', locale: '' },
					drag: 'bibliography'
				})]
			);
			await Zotero.QuickCopy.loadSiteSettings();

			Zotero.QuickCopy.lastActiveURL = 'https://test.org/styles/apa';
			let bib = Zotero.QuickCopy.getFormat('bibliography');
			assert.equal(bib.id, APA_STYLE_ID);
		});

		describe("default settings (no site match)", function () {
			it("should return the default bibliographySetting for mode='bibliography'", function () {
				Zotero.QuickCopy.lastActiveURL = 'https://no-match.test/';
				let result = Zotero.QuickCopy.getFormat('bibliography');
				let expected = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.bibliographySetting')
				);
				assert.equal(result.mode, 'bibliography');
				assert.equal(result.id, expected.id);
			});

			it("should return the default exportSetting for mode='export'", function () {
				Zotero.QuickCopy.lastActiveURL = 'https://no-match.test/';
				let result = Zotero.QuickCopy.getFormat('export');
				let expected = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.exportSetting')
				);
				assert.equal(result.mode, 'export');
				assert.equal(result.id, expected.id);
			});

			it("should follow preferredFormatOnDrag for drag (no mode)", function () {
				Zotero.QuickCopy.lastActiveURL = 'https://no-match.test/';
				Zotero.Prefs.set('export.quickCopy.preferredFormatOnDrag', 'export');
				let result = Zotero.QuickCopy.getFormat();
				assert.equal(result.mode, 'export');

				Zotero.Prefs.set('export.quickCopy.preferredFormatOnDrag', 'bibliography');
				result = Zotero.QuickCopy.getFormat();
				assert.equal(result.mode, 'bibliography');
			});
		});

		describe("legacy site setting format", function () {
			it("should resolve a legacy bibliography site setting", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				let legacy = JSON.stringify({
					mode: 'bibliography',
					id: APA_STYLE_ID,
					contentType: 'html',
					locale: 'en-US'
				});
				await setSiteSetting(legacy);

				// bibliography mode → site override
				let bib = Zotero.QuickCopy.getFormat('bibliography');
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);
				assert.equal(bib.contentType, 'html');
				assert.equal(bib.locale, 'en-US');

				// export mode → no site override → global default
				let exp = Zotero.QuickCopy.getFormat('export');
				let globalExport = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.exportSetting')
				);
				assert.equal(exp.mode, 'export');
				assert.equal(exp.id, globalExport.id);

				// drag → legacy entry's mode wins (preserves old behavior)
				let drag = Zotero.QuickCopy.getFormat();
				assert.equal(drag.mode, 'bibliography');
				assert.equal(drag.id, APA_STYLE_ID);
			});

			it("should resolve a legacy export site setting", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				let legacy = JSON.stringify({
					mode: 'export',
					id: BIBTEX_TRANSLATOR_ID
				});
				await setSiteSetting(legacy);

				// export mode → site override
				let exp = Zotero.QuickCopy.getFormat('export');
				assert.equal(exp.mode, 'export');
				assert.equal(exp.id, BIBTEX_TRANSLATOR_ID);

				// bibliography mode → no site override → global default
				let bib = Zotero.QuickCopy.getFormat('bibliography');
				let globalBib = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.bibliographySetting')
				);
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, globalBib.id);

				// drag → legacy entry's mode wins
				let drag = Zotero.QuickCopy.getFormat();
				assert.equal(drag.mode, 'export');
				assert.equal(drag.id, BIBTEX_TRANSLATOR_ID);
			});

			it("should support legacy 'bibliography/html=...' string format", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				await setSiteSetting(`bibliography/html=${APA_STYLE_ID}`);

				let bib = Zotero.QuickCopy.getFormat('bibliography');
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);
				assert.equal(bib.contentType, 'html');
			});
		});

		describe("new site setting format", function () {
			it("should resolve a new-format site setting with bibliography only", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				let siteFormat = JSON.stringify({
					bibliography: {
						id: APA_STYLE_ID,
						contentType: '',
						locale: 'fr-FR'
					},
					drag: 'bibliography'
				});
				await setSiteSetting(siteFormat);

				let bib = Zotero.QuickCopy.getFormat('bibliography');
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);
				assert.equal(bib.locale, 'fr-FR');

				// export → no site override → global default
				let exp = Zotero.QuickCopy.getFormat('export');
				let globalExport = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.exportSetting')
				);
				assert.equal(exp.id, globalExport.id);

				// drag → site.drag = 'bibliography' → site bib
				let drag = Zotero.QuickCopy.getFormat();
				assert.equal(drag.mode, 'bibliography');
				assert.equal(drag.id, APA_STYLE_ID);
			});

			it("should resolve a new-format site setting with both bib and export", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				let siteFormat = JSON.stringify({
					bibliography: { id: APA_STYLE_ID, contentType: '', locale: '' },
					export: { id: BIBTEX_TRANSLATOR_ID },
					drag: 'export'
				});
				await setSiteSetting(siteFormat);

				let bib = Zotero.QuickCopy.getFormat('bibliography');
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);

				let exp = Zotero.QuickCopy.getFormat('export');
				assert.equal(exp.mode, 'export');
				assert.equal(exp.id, BIBTEX_TRANSLATOR_ID);

				// drag → site.drag = 'export' → site export
				let drag = Zotero.QuickCopy.getFormat();
				assert.equal(drag.mode, 'export');
				assert.equal(drag.id, BIBTEX_TRANSLATOR_ID);
			});

			it("should follow site.drag override regardless of preferredFormatOnDrag", async function () {
				Zotero.QuickCopy.lastActiveURL = `https://${domain}/`;
				Zotero.Prefs.set('export.quickCopy.preferredFormatOnDrag', 'bibliography');
				let siteFormat = JSON.stringify({
					bibliography: { id: APA_STYLE_ID, contentType: '', locale: '' },
					export: { id: BIBTEX_TRANSLATOR_ID },
					drag: 'export'
				});
				await setSiteSetting(siteFormat);

				let drag = Zotero.QuickCopy.getFormat();
				assert.equal(drag.mode, 'export');
				assert.equal(drag.id, BIBTEX_TRANSLATOR_ID);
			});
		});
	});

	describe("#getContentFromItems()", function () {
		it("should generate BibTeX", async function () {
			var item = await createDataObject('item');
			var content = "";
			var worked = false;
			
			await Zotero.Translators.init();
			
			var translatorID = '9cb70025-a888-4a29-a210-93ec52da40d4'; // BibTeX
			var format = 'export=' + translatorID;
			Zotero.Prefs.set("export.quickCopy.exportSetting", format);
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
		
		// This shouldn't be used
		Zotero.Prefs.set('export.lastLocale', 'fr-FR');
		await Zotero.Styles.init();
		
		var format = 'bibliography=http://www.zotero.org/styles/apa';
		Zotero.Prefs.set("export.quickCopy.bibliographySetting", format);
		
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

		Zotero.Prefs.set("export.quickCopy.bibliographySetting", format);
		
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
