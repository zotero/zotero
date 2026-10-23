describe("Zotero.Shortcuts", function () {
	var win, doc;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		win.Zotero_Tabs.select("zotero-pane");
	});

	after(function () {
		win.close();
	});

	function dispatchKey(key, { accel = false, alt = false, shift = false } = {}) {
		let event = new win.KeyboardEvent("keydown", {
			key,
			metaKey: Zotero.isMac && accel,
			ctrlKey: !Zotero.isMac && accel,
			altKey: alt,
			shiftKey: shift,
			bubbles: true,
			cancelable: true,
		});
		doc.getElementById("zotero-pane").dispatchEvent(event);
		return event;
	}

	it("should canonicalize hand-written reserved combo strings", function () {
		assert.equal(Zotero.Shortcuts._canonicalizeComboString("shift+accel+t"), "accel+shift+T");
		// A key that is the "+" character itself
		assert.equal(Zotero.Shortcuts._canonicalizeComboString("accel++"), "accel++");
		// A typo must fail loudly rather than silently reserve the bare key
		assert.throws(() => Zotero.Shortcuts._canonicalizeComboString("acel+W"));
	});

	it("should dispatch built-in pref shortcuts", function () {
		// Built-ins are registered from the `keys.` prefs at startup
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+shift+K"));
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+shift+L"));
		// Keys with display-only <key> elements are registry-dispatched too,
		// and the elements get their attributes synced on window attach
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+;"));
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+shift+C"));
		assert.equal(doc.getElementById("key_showTabsMenu").getAttribute("key"), ";");
		assert.equal(doc.getElementById("key_copyCitation").getAttribute("key"), "A");
		// Platform-formatted display text (ShortcutUtils), e.g. ⇧⌘K / Ctrl+Shift+K
		assert.include(Zotero.Shortcuts.getDisplayString("zotero-quicksearch"), "K");

		// accel+shift+L (library) focuses the collections tree
		let event = dispatchKey("L", { accel: true, shift: true });
		assert.isTrue(event.defaultPrevented);
		let tree = doc.getElementById(win.ZoteroPane.collectionsView.id);
		assert.isTrue(tree === doc.activeElement || tree.contains(doc.activeElement));
	});

	it("should dispatch migrated mainKeyset command keys", function () {
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+shift+I"));
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+alt+shift+I"));
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+shift+F"));
		// Display-only <key> elements are created dynamically and don't dispatch
		let keyElem = doc.getElementById("key_import");
		assert.equal(keyElem.getAttribute("key"), "I");
		assert.isFalse(keyElem.hasAttribute("command"));
		assert.equal(keyElem.parentElement.id, "zoteroShortcutKeyset");

		let importStub = sinon.stub(win.Zotero_File_Interface, "showImportWizard");
		try {
			let event = dispatchKey("i", { accel: true, shift: true });
			assert.isTrue(importStub.calledOnce);
			assert.isTrue(event.defaultPrevented);
		}
		finally {
			importStub.restore();
		}

		// accel+; (tabs menu) is registered from its pref and must not be
		// masked by the static reserved list
		let tabsStub = sinon.stub(win.Zotero_Tabs, "showTabsMenu");
		try {
			let event = dispatchKey(";", { accel: true });
			assert.isTrue(tabsStub.calledOnce);
			assert.isTrue(event.defaultPrevented);
		}
		finally {
			tabsStub.restore();
		}
	});
});
