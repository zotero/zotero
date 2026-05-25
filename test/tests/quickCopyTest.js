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
			let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
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
			let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
			assert.equal(bib.id, APA_STYLE_ID);
		});

		describe("default settings (no site match)", function () {
			it("should return the default bibliographySetting for mode='bibliography'", function () {
				Zotero.QuickCopy.lastActiveURL = 'https://no-match.test/';
				let result = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
				let expected = Zotero.QuickCopy.unserializeSetting(
					Zotero.Prefs.get('export.quickCopy.bibliographySetting')
				);
				assert.equal(result.mode, 'bibliography');
				assert.equal(result.id, expected.id);
			});

			it("should return the default exportSetting for mode='export'", function () {
				Zotero.QuickCopy.lastActiveURL = 'https://no-match.test/';
				let result = Zotero.QuickCopy.getFormat({ mode: 'export' });
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
				let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);
				assert.equal(bib.contentType, 'html');
				assert.equal(bib.locale, 'en-US');

				// export mode → no site override → global default
				let exp = Zotero.QuickCopy.getFormat({ mode: 'export' });
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
				let exp = Zotero.QuickCopy.getFormat({ mode: 'export' });
				assert.equal(exp.mode, 'export');
				assert.equal(exp.id, BIBTEX_TRANSLATOR_ID);

				// bibliography mode → no site override → global default
				let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
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

				let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
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

				let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);
				assert.equal(bib.locale, 'fr-FR');

				// export → no site override → global default
				let exp = Zotero.QuickCopy.getFormat({ mode: 'export' });
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

				let bib = Zotero.QuickCopy.getFormat({ mode: 'bibliography' });
				assert.equal(bib.mode, 'bibliography');
				assert.equal(bib.id, APA_STYLE_ID);

				let exp = Zotero.QuickCopy.getFormat({ mode: 'export' });
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
			
			await Zotero.Translators.init();

			var translatorID = '9cb70025-a888-4a29-a210-93ec52da40d4'; // BibTeX
			var format = 'export=' + translatorID;
			Zotero.Prefs.set("export.quickCopy.exportSetting", format);
			// Translator code for selected format is loaded automatically, so wait for it
			var translator = Zotero.Translators.get(translatorID);
			while (!translator.code) {
				await Zotero.Promise.delay(50);
			}

			let content = Zotero.QuickCopy.getContentFromItems([item], format);
			assert.isString(content.text);
			assert.isTrue(content.text.trim().startsWith('@'));
		});
	});
	
	it("should generate bibliography in default locale if Quick Copy locale not set", async function () {
		var item = createUnsavedDataObject('item', { itemType: 'webpage', title: 'Foo' });
		item.setField('date', '2020-03-11');
		await item.saveTx();

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
		let content = Zotero.QuickCopy.getContentFromItems([item], format, { asCitations: true });
		assert.equal(content.text, '《新型数据财产的行为主义保护：基于财产权理论的分析》。');
	});
});


describe("Smart copy", function () {
	var win, zp, doc;
	var regularItem, attachment, annotation, note;
	var clipboardService;
	const SMART_COPY_BIB = {
		mode: 'bibliography',
		id: 'http://www.zotero.org/styles/apa',
		contentType: '',
		locale: ''
	};

	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
		doc = win.document;
		clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"]
			.getService(Components.interfaces.nsIClipboard);

		await Zotero.Styles.init();
		await Zotero.Translators.init();

		// Preload Note Markdown / Note HTML translators
		for (let id of [
			Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN,
			Zotero.Translators.TRANSLATOR_ID_NOTE_HTML,
		]) {
			let translator = Zotero.Translators.get(id);
			translator.cacheCode = true;
			await Zotero.Translators.getCodeForTranslator(translator);
		}

		regularItem = createUnsavedDataObject('item', {
			itemType: 'journalArticle',
			title: 'My Smart Copy Paper'
		});
		regularItem.setField('date', '2020');
		regularItem.setCreators([
			{ firstName: 'Jane', lastName: 'Smartcopy', creatorType: 'author' }
		]);
		await regularItem.saveTx();

		attachment = await importFileAttachment('test.pdf', { parentItemID: regularItem.id });
		annotation = await createAnnotation('highlight', attachment);

		note = createUnsavedDataObject('item', { itemType: 'note' });
		note.setNote('<p>Test note content</p>');
		await note.saveTx();
	});

	// The test runner has a root-level afterEach (test/content/runtests.js)
	// that clears any user-set pref after every test. Re-pin the bibliography
	// style here before each test.
	beforeEach(function () {
		Zotero.Prefs.set('export.quickCopy.bibliographySetting', JSON.stringify(SMART_COPY_BIB));
	});

	after(async function () {
		win.Zotero_Tabs.closeAll();
		win.close();
	});

	function getClipboardText() {
		let transferable = Components.classes["@mozilla.org/widget/transferable;1"]
			.createInstance(Components.interfaces.nsITransferable);
		transferable.init(null);
		transferable.addDataFlavor('text/plain');
	
		clipboardService.getData(transferable, Components.interfaces.nsIClipboard.kGlobalClipboard);
		let str = {};
		transferable.getTransferData('text/plain', str, {});
		return str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
	}

	function clearClipboard() {
		clipboardService.emptyClipboard(Components.interfaces.nsIClipboard.kGlobalClipboard);
	}

	describe("Library tab", function () {
		beforeEach(async function () {
			await selectLibrary(win);
			doc.getElementById('item-tree-main').focus();
		});

		it("should copy citation for a regular item", async function () {
			await zp.itemsView.selectItem(regularItem.id);
			clearClipboard();
			doc.getElementById('key_smartCopy').doCommand();
			assert.equal(getClipboardText(), '(Smartcopy, 2020)');
		});

		it("should copy annotation content when an annotation is selected", async function () {
			await zp.itemsView.selectItem(annotation.id);
			clearClipboard();
			doc.getElementById('key_smartCopy').doCommand();
			assert.include(getClipboardText(), annotation.annotationText);
		});

		it("should copy note content when a note is selected", async function () {
			await zp.itemsView.selectItem(note.id);
			clearClipboard();
			doc.getElementById('key_smartCopy').doCommand();
			assert.include(getClipboardText(), 'Test note content');
		});
	});

	describe("Reader tab", function () {
		var reader;
		var hasFocusStub;

		before(async function () {
			reader = await Zotero.Reader.open(attachment.id);
			await reader._initPromise;
			await reader._internalReader._primaryView.initializedPromise;
			while (!reader._iframeWindow) {
				await Zotero.Promise.delay(50);
			}
			// Pretend that the reader is focused
			hasFocusStub = sinon.stub(reader._iframeWindow.document, 'hasFocus').returns(true);
		});

		beforeEach(async function () {
			await win.Zotero_Tabs.select(reader.tabID);
		});

		after(function () {
			hasFocusStub.restore();
		});

		it("should copy parent citation when nothing is selected in the reader", function () {
			clearClipboard();
			doc.getElementById('key_smartCopy').doCommand();
			assert.equal(getClipboardText(), '(Smartcopy, 2020)');
		});

		it("should copy selected annotation", function () {
			let stub = sinon.stub(reader, 'getSelectedAnnotationIDs').returns([annotation.key]);
			try {
				clearClipboard();
				doc.getElementById('key_smartCopy').doCommand();
				assert.include(getClipboardText(), annotation.annotationText);
			}
			finally {
				stub.restore();
			}
		});
	});
});
