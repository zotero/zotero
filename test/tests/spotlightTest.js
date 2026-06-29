"use strict";

describe("Zotero.Spotlight", function () {
	var savedPrefs = {};
	var savedOwner = null;
	var ranSetup = false;

	var PREF_KEYS = [
		'spotlight.enabled',
		'spotlight.openOnConfirm',
		'spotlight.indexFullText',
		'spotlight.excludeDataDir',
		'spotlight.titleTemplate',
		'spotlight.descriptionTemplate',
		'spotlight.excludedLibraries',
		'spotlight.lastSignature',
		'spotlight.indexSchemaVersion'
	];

	function ownerPath() {
		let home = Services.env.get('HOME');
		return PathUtils.join(
			home, 'Library', 'Application Support', 'org.zotero.spotlight', 'owner.json'
		);
	}

	function neverIndexPath() {
		return PathUtils.join(Zotero.DataDirectory.dir, '.metadata_never_index');
	}

	// Unique lowercase-alnum token so a Core Spotlight wildcard query can find a
	// specific item without colliding with anything else in the index.
	function token() {
		let rand = Math.random().toString(36).slice(2, 12);
		return 'ztspot' + rand.replace(/[^a-z0-9]/g, '');
	}

	// Poll the real index until `predicate(results)` holds or we time out. Success
	// returns in ~2-3s; the cap is kept under the harness's 10s test timeout so a
	// failing wait gives up and reports a clean assertion rather than hanging.
	async function searchUntil(query, predicate, timeout = 8000) {
		let start = Date.now();
		let results = [];
		while (Date.now() - start < timeout) {
			results = Zotero.Spotlight.search(query);
			if (predicate(results)) {
				return results;
			}
			await Zotero.Promise.delay(500);
		}
		return results;
	}

	async function waitForFileState(path, shouldExist, timeout = 5000) {
		let start = Date.now();
		while (Date.now() - start < timeout) {
			if ((await IOUtils.exists(path)) === shouldExist) {
				return true;
			}
			await Zotero.Promise.delay(100);
		}
		return false;
	}

	before(async function () {
		if (!Zotero.isMac || !Zotero.Spotlight || !Zotero.Spotlight.available) {
			Zotero.debug("Spotlight: bridge unavailable; skipping Spotlight tests");
			this.skip();
			return;
		}
		ranSetup = true;
		for (let key of PREF_KEYS) {
			savedPrefs[key] = Zotero.Prefs.get(key);
		}
		try {
			savedOwner = await IOUtils.readUTF8(ownerPath());
		}
		catch {
			savedOwner = null;
		}
	});

	after(async function () {
		if (!ranSetup) {
			return;
		}
		// Stop observing and drop anything we put in the shared index.
		try {
			Zotero.Spotlight.stop();
		}
		catch {}
		try {
			await Zotero.Spotlight.clearIndex();
		}
		catch {}
		// Restore prefs
		for (let key of PREF_KEYS) {
			if (savedPrefs[key] === undefined) {
				Zotero.Prefs.clear(key);
			}
			else {
				Zotero.Prefs.set(key, savedPrefs[key]);
			}
		}
		// Restore the previous owner.json so the user's normal profile keeps
		// ownership of the system-wide index.
		let path = ownerPath();
		if (savedOwner === null) {
			try {
				await IOUtils.remove(path);
			}
			catch {}
		}
		else {
			await IOUtils.makeDirectory(PathUtils.parent(path), {
				createAncestors: true,
				ignoreExisting: true
			});
			await IOUtils.writeUTF8(path, savedOwner);
		}
	});

	describe("preferences pane visibility", function () {
		async function loadAdvancedPane() {
			let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
				pane: 'zotero-prefpane-advanced'
			});
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			return win;
		}

		it("should show the Spotlight section when the bridge is available", async function () {
			let win = await loadAdvancedPane();
			let section = win.document.getElementById('zotero-prefpane-advanced-spotlight');
			assert.isFalse(section.hidden);
			win.close();
		});

		it("should hide the Spotlight section when the bridge is unavailable (macOS < 11)", async function () {
			// On macOS < 11 the bridge dylib can't load, so available is false.
			let stub = sinon.stub(Zotero.Spotlight, 'available').get(() => false);
			try {
				let win = await loadAdvancedPane();
				let section = win.document.getElementById('zotero-prefpane-advanced-spotlight');
				assert.isTrue(section.hidden);
				win.close();
			}
			finally {
				stub.restore();
			}
		});

		// The full controls only matter to the profile that's actually indexing.
		var CONTROL_GROUPS = [
			'spotlight-controls',
			'spotlight-libraries-group',
			'spotlight-privacy-group',
			'spotlight-format-group',
			'spotlight-rebuild'
		];

		async function withOwner(record, fn) {
			let prev = await IOUtils.readUTF8(ownerPath()).catch(() => null);
			await IOUtils.makeDirectory(PathUtils.parent(ownerPath()), {
				createAncestors: true,
				ignoreExisting: true
			});
			if (record === null) {
				await IOUtils.remove(ownerPath()).catch(() => {});
			}
			else {
				await IOUtils.writeUTF8(ownerPath(), JSON.stringify(record));
			}
			try {
				await fn();
			}
			finally {
				if (prev === null) {
					await IOUtils.remove(ownerPath()).catch(() => {});
				}
				else {
					await IOUtils.writeUTF8(ownerPath(), prev);
				}
			}
		}

		it("should show the full controls when this profile owns the index", async function () {
			Zotero.Prefs.set('spotlight.enabled', true);
			// No owner recorded -> this profile would index, so show everything.
			await withOwner(null, async function () {
				let win = await loadAdvancedPane();
				try {
					await win.Zotero_Preferences.Spotlight._updateEnabledUI();
					assert.isTrue(win.document.getElementById('spotlight-owner-notice').hidden);
					for (let id of CONTROL_GROUPS) {
						assert.isFalse(win.document.getElementById(id).hidden, id);
					}
				}
				finally {
					win.close();
				}
			});
		});

		it("should show only the take-over button when another profile owns the index", async function () {
			Zotero.Prefs.set('spotlight.enabled', true);
			await withOwner({ dataDir: '/some/other/profile', bundleID: 'org.zotero.zotero' }, async function () {
				let win = await loadAdvancedPane();
				try {
					await win.Zotero_Preferences.Spotlight._updateEnabledUI();
					// Take-over notice shown...
					assert.isFalse(win.document.getElementById('spotlight-owner-notice').hidden);
					// ...and every indexing control hidden.
					for (let id of CONTROL_GROUPS) {
						assert.isTrue(win.document.getElementById(id).hidden, id);
					}
				}
				finally {
					win.close();
				}
			});
		});
	});

	describe("zotero://spotlight click action", function () {
		var win, zp;

		function runHandler(url) {
			let handler = Services.io.getProtocolHandler('zotero').wrappedJSObject;
			let uri = Services.io.newURI(url, null, null);
			return handler._extensions['zotero://spotlight'].newChannel(uri);
		}

		async function waitForItemSelect(item, timeout = 5000) {
			let start = Date.now();
			while (Date.now() - start < timeout) {
				if (zp.getSelectedItems().includes(item)) {
					return true;
				}
				await Zotero.Promise.delay(20);
			}
			return false;
		}

		before(async function () {
			win = await loadZoteroPane();
			zp = win.ZoteroPane;
		});

		after(function () {
			if (win) {
				win.close();
			}
		});

		it("should show the item in the library when set to \"Show in Library\"", async function () {
			Zotero.Prefs.set('spotlight.openOnConfirm', false);
			let item = await createDataObject('item', { title: 'Spotlight Select' });
			runHandler(`zotero://spotlight/library/items/${item.key}`);
			assert.isTrue(await waitForItemSelect(item));
		});

		it("should open the best attachment when set to \"Open File\"", async function () {
			Zotero.Prefs.set('spotlight.openOnConfirm', true);
			let item = await createDataObject('item', { title: 'Spotlight Open' });
			let attachment = await importPDFAttachment(item);
			let stub = sinon.stub(Zotero.FileHandlers, 'open').resolves(true);
			try {
				runHandler(`zotero://spotlight/library/items/${item.key}`);
				await waitForCallback(() => stub.called, 50, 10);
				assert.isTrue(stub.calledOnce);
				assert.equal(stub.firstCall.args[0].id, attachment.id);
			}
			finally {
				stub.restore();
				Zotero.Prefs.set('spotlight.openOnConfirm', false);
			}
		});

		it("should fall back to selecting when there is nothing to open", async function () {
			Zotero.Prefs.set('spotlight.openOnConfirm', true);
			let item = await createDataObject('item', { title: 'Spotlight No Attachment' });
			try {
				runHandler(`zotero://spotlight/library/items/${item.key}`);
				assert.isTrue(await waitForItemSelect(item));
			}
			finally {
				Zotero.Prefs.set('spotlight.openOnConfirm', false);
			}
		});

		it("should resolve a group-library item path", async function () {
			Zotero.Prefs.set('spotlight.openOnConfirm', false);
			let group = await createGroup();
			let item = await createDataObject('item', { libraryID: group.libraryID, title: 'Spotlight Group' });
			runHandler(`zotero://spotlight/groups/${group.id}/items/${item.key}`);
			assert.isTrue(await waitForItemSelect(item));
		});
	});

	describe("ownership", function () {
		// owner.json is restored by the outer after().

		it("should report a foreign owner from another profile", async function () {
			await IOUtils.makeDirectory(PathUtils.parent(ownerPath()), {
				createAncestors: true,
				ignoreExisting: true
			});
			await IOUtils.writeUTF8(ownerPath(), JSON.stringify({
				dataDir: '/some/other/profile',
				bundleID: 'org.zotero.zotero'
			}));
			let owner = await Zotero.Spotlight.getForeignOwner();
			assert.ok(owner);
			assert.equal(owner.dataDir, '/some/other/profile');
		});

		it("should take ownership for this profile", async function () {
			await Zotero.Spotlight.takeOwnership();
			// No longer foreign once it's us
			assert.isNull(await Zotero.Spotlight.getForeignOwner());
			let written = JSON.parse(await IOUtils.readUTF8(ownerPath()));
			assert.equal(written.dataDir, Zotero.DataDirectory.dir);
		});
	});

	describe("data directory exclusion", function () {
		before(function () {
			// The exclusion only applies while the feature is enabled.
			Zotero.Prefs.set('spotlight.enabled', true);
		});

		it("should write .metadata_never_index when the exclusion is on", async function () {
			Zotero.Prefs.set('spotlight.excludeDataDir', false);
			assert.isTrue(await waitForFileState(neverIndexPath(), false));
			Zotero.Prefs.set('spotlight.excludeDataDir', true);
			assert.isTrue(await waitForFileState(neverIndexPath(), true),
				".metadata_never_index should be created");
		});

		it("should remove .metadata_never_index when the exclusion is off", async function () {
			Zotero.Prefs.set('spotlight.excludeDataDir', true);
			assert.isTrue(await waitForFileState(neverIndexPath(), true));
			Zotero.Prefs.set('spotlight.excludeDataDir', false);
			assert.isTrue(await waitForFileState(neverIndexPath(), false),
				".metadata_never_index should be removed");
			Zotero.Prefs.set('spotlight.excludeDataDir', true);
		});
	});

	describe("indexing round-trip", function () {
		before(async function () {
			if (!Zotero.Spotlight.indexingAvailable()) {
				Zotero.debug("Spotlight: indexing unavailable (unsigned build or "
					+ "Spotlight off); skipping round-trip tests");
				this.skip();
				return;
			}
			Zotero.Prefs.set('spotlight.enabled', true);
			Zotero.Prefs.set('spotlight.indexFullText', true);
			Zotero.Prefs.set('spotlight.titleTemplate', '{{ title }}');
			Zotero.Prefs.set('spotlight.descriptionTemplate', '{{ firstCreator }}{{ year prefix=" (" suffix=")" }}');
			Zotero.Prefs.set('spotlight.excludedLibraries', '[]');
			// Own the (shared) index so the live notifier path runs. This resets
			// the channel's Core Spotlight domain -- authorized for this profile.
			await Zotero.Spotlight.takeOwnership();
		});

		it("should index a new item via the notifier", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok + ' new' });
			let path = `library/items/${item.key}`;
			let results = await searchUntil(`title == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
		});

		it("should re-index an item when it is modified", async function () {
			let tok1 = token();
			let item = await createDataObject('item', { title: tok1 });
			let path = `library/items/${item.key}`;
			assert.include(await searchUntil(`title == "*${tok1}*"c`, r => r.includes(path)), path);

			let tok2 = token();
			item.setField('title', tok2);
			await item.saveTx();
			let results = await searchUntil(`title == "*${tok2}*"c`, r => r.includes(path));
			assert.include(results, path);
		});

		it("should remove an item from the index when it is trashed", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok });
			let path = `library/items/${item.key}`;
			// Confirm it's indexed first, so the removal check can't pass vacuously.
			assert.include(await searchUntil(`title == "*${tok}*"c`, r => r.includes(path)), path);

			item.deleted = true;
			await item.saveTx();
			let results = await searchUntil(`title == "*${tok}*"c`, r => !r.includes(path));
			assert.notInclude(results, path);
		});

		it("should remove an item from the index when it is deleted", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok });
			let path = `library/items/${item.key}`;
			// Confirm it's indexed first, so the removal check can't pass vacuously.
			assert.include(await searchUntil(`title == "*${tok}*"c`, r => r.includes(path)), path);

			await item.eraseTx();
			let results = await searchUntil(`title == "*${tok}*"c`, r => !r.includes(path));
			assert.notInclude(results, path);
		});

		it("should index the whole library via rebuild()", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok });
			let path = `library/items/${item.key}`;
			await Zotero.Spotlight.rebuild();
			let results = await searchUntil(`title == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
		});

		it("should put item fields into searchable content", async function () {
			let tok = token();
			let item = await createDataObject('item', { itemType: 'journalArticle', title: 'Field Content' });
			item.setField('abstractNote', 'abstract body ' + tok);
			await item.saveTx();
			let path = `library/items/${item.key}`;
			// The token is only in a field, so it must surface via textContent.
			let results = await searchUntil(`textContent == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
		});

		it("should put child note text into searchable content", async function () {
			let tok = token();
			let parent = await createDataObject('item', { itemType: 'journalArticle', title: 'Note Parent ' + token() });
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			note.setNote(`<p>note body ${tok}</p>`);
			await note.saveTx();
			let path = `library/items/${parent.key}`;
			// Drop the note from the cache so indexing must load its data itself,
			// otherwise getNote() would throw on the unloaded note.
			Zotero.Items.unload(note.id);
			await Zotero.Spotlight.rebuild();
			// The token is only in the child note's HTML body.
			let results = await searchUntil(`textContent == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
		});

		it("should index attachment full text only when enabled", async function () {
			let tok = token();
			let parent = await createDataObject('item', { title: 'FullText Parent ' + token() });
			let path = `library/items/${parent.key}`;

			// A plain-text attachment whose *file contents* (not its name/title)
			// hold the token, so a textContent hit can only come from full text.
			let tmpFile = Zotero.getTempDirectory();
			tmpFile.append('attachment.txt');
			await Zotero.File.putContentsAsync(tmpFile.path, 'attachment full text ' + tok);
			await Zotero.Attachments.importFromFile({
				file: tmpFile,
				parentItemID: parent.id,
				contentType: 'text/plain',
				charset: 'utf-8',
				title: 'plainfile'
			});

			Zotero.Prefs.set('spotlight.indexFullText', true);
			await Zotero.Spotlight.rebuild();
			let withFT = await searchUntil(`textContent == "*${tok}*"c`, r => r.includes(path));
			assert.include(withFT, path, "full text should be indexed when enabled");

			Zotero.Prefs.set('spotlight.indexFullText', false);
			await Zotero.Spotlight.rebuild();
			let withoutFT = await searchUntil(`textContent == "*${tok}*"c`, r => !r.includes(path));
			assert.notInclude(withoutFT, path, "full text should not be indexed when disabled");

			Zotero.Prefs.set('spotlight.indexFullText', true);
		});

		it("should still index full text when a huge note would fill the budget", async function () {
			let tok = token();
			let parent = await createDataObject('item', { title: 'Reserve Parent ' + token() });
			let path = `library/items/${parent.key}`;

			// A note longer than the whole content budget. Without a reserved
			// slice for full text, this note alone would crowd it out entirely.
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			note.setNote('<p>' + 'filler '.repeat(10000) + '</p>');
			await note.saveTx();

			// Full text (token only in the file contents) must still land.
			let tmpFile = Zotero.getTempDirectory();
			tmpFile.append('reserve.txt');
			await Zotero.File.putContentsAsync(tmpFile.path, 'reserved full text ' + tok);
			await Zotero.Attachments.importFromFile({
				file: tmpFile,
				parentItemID: parent.id,
				contentType: 'text/plain',
				charset: 'utf-8',
				title: 'reservefile'
			});

			Zotero.Prefs.set('spotlight.indexFullText', true);
			await Zotero.Spotlight.rebuild();
			let results = await searchUntil(`textContent == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path, "full text should survive a budget-filling note");
		});

		it("should skip excluded libraries and flag needsReindex", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok });
			let path = `library/items/${item.key}`;
			await Zotero.Spotlight.rebuild();
			// Confirm it's indexed first, so the exclusion check can't pass vacuously.
			assert.include(await searchUntil(`title == "*${tok}*"c`, r => r.includes(path)), path);

			// Excluding the user library should make a rebuild needed...
			Zotero.Prefs.set('spotlight.excludedLibraries',
				JSON.stringify([Zotero.Libraries.userLibraryID]));
			assert.isTrue(Zotero.Spotlight.needsReindex());

			// ...and after rebuilding, the item should be gone.
			await Zotero.Spotlight.rebuild();
			let excluded = await searchUntil(`title == "*${tok}*"c`, r => !r.includes(path));
			assert.notInclude(excluded, path);

			// Re-including brings it back.
			Zotero.Prefs.set('spotlight.excludedLibraries', '[]');
			await Zotero.Spotlight.rebuild();
			let included = await searchUntil(`title == "*${tok}*"c`, r => r.includes(path));
			assert.include(included, path);
		});

		it("should apply the title template to the indexed title", async function () {
			let tok = token();
			Zotero.Prefs.set('spotlight.titleTemplate', tok + ' {{ title }}');
			let item = await createDataObject('item', { title: 'Templated' });
			let path = `library/items/${item.key}`;
			await Zotero.Spotlight.rebuild();
			// The template prefix only appears in the title if templating ran.
			let results = await searchUntil(`title == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
			Zotero.Prefs.set('spotlight.titleTemplate', '{{ title }}');
		});

		it("should support shared filename-template variables and modifiers", async function () {
			// replaceFrom/replaceTo is a file-rename modifier the old renderer
			// lacked -- proving Spotlight now shares that engine.
			let tokA = token();
			let tokB = token();
			Zotero.Prefs.set('spotlight.titleTemplate', `{{ title replaceFrom="${tokA}" replaceTo="${tokB}" }}`);
			let item = await createDataObject('item', { title: tokA });
			let path = `library/items/${item.key}`;
			await Zotero.Spotlight.rebuild();
			// Title indexed as the replacement...
			let replaced = await searchUntil(`title == "*${tokB}*"c`, r => r.includes(path));
			assert.include(replaced, path);
			// ...not the original.
			let original = await searchUntil(`title == "*${tokA}*"c`, r => !r.includes(path));
			assert.notInclude(original, path);
			Zotero.Prefs.set('spotlight.titleTemplate', '{{ title }}');
		});

		it("should not be visible to mdfind (Core Spotlight is separate)", async function () {
			let tok = token();
			let item = await createDataObject('item', { title: tok });
			let path = `library/items/${item.key}`;
			// In the real index per our query...
			let results = await searchUntil(`title == "*${tok}*"c`, r => r.includes(path));
			assert.include(results, path);
			// ...but mdfind (file-metadata index) can't see Core Spotlight content.
			let out = await Zotero.Utilities.Internal.subprocess('/usr/bin/mdfind', [tok]);
			assert.notInclude(out, item.key);
		});
	});
});
