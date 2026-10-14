describe("Zotero.ShortcutManager", function () {
	var plugin = usePluginSandbox();
	var other = usePluginSandbox({ id: "other-shortcut-plugin@zotero.org" });
	var log = createCallbackLog();
	var win, doc, Zotero_Tabs;
	var calls;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		Zotero_Tabs = win.Zotero_Tabs;
		Zotero_Tabs.select("zotero-pane");
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		log.reset();
		calls = [];
		plugin.load(["default", "shortcut"]);
		plugin.expose("report", log.report);
		plugin.expose("record", name => calls.push(name));
	});

	afterEach(async function () {
		Zotero_Tabs.select("zotero-pane");
		Zotero_Tabs.closeAll();
		await Zotero.ShortcutManager._shortcutManager._unregisterByPluginID(plugin.id);
		await Zotero.ShortcutManager._shortcutManager._unregisterByPluginID(other.id);
	});

	// A main window accel+alt+Y shortcut whose onCommand reports its context
	function registerShortcut(options = {}) {
		return plugin.run(options => Zotero.ShortcutManager.registerShortcut({
			shortcutID: "default-test",
			key: "Y",
			modifiers: ["accel", "alt"],
			target: "mainWindow",
			onCommand: context => report("onCommand", context),
			...options,
		}), options);
	}

	// A shortcut whose onCommand records its name, declining the keystroke when told to
	function registerRecorder(name, options = {}, decline = false) {
		return plugin.run((name, options, decline) => Zotero.ShortcutManager.registerShortcut({
			shortcutID: name + "-test",
			key: "Y",
			modifiers: ["accel", "alt"],
			target: "mainWindow",
			onCommand: () => {
				record(name);
				// Returning false declines the keystroke
				return decline ? false : undefined;
			},
			...options,
		}), name, options, decline);
	}

	function unregisterShortcut(shortcutID) {
		return plugin.run(shortcutID => Zotero.ShortcutManager.unregisterShortcut(shortcutID), shortcutID);
	}

	function dispatchKey(key, { accel = false, alt = false, shift = false, ctrl = false, keyCode, code } = {}) {
		let event = new win.KeyboardEvent("keydown", {
			key,
			keyCode,
			code,
			metaKey: Zotero.isMac && accel,
			ctrlKey: ctrl || (!Zotero.isMac && accel),
			altKey: alt,
			shiftKey: shift,
			bubbles: true,
			cancelable: true,
		});
		doc.getElementById("zotero-pane").dispatchEvent(event);
		return event;
	}

	it("should reject invalid combos", function () {
		assert.isFalse(registerShortcut({ modifiers: ["shift"] }), "no accel or alt modifier");
		assert.isFalse(registerShortcut({ modifiers: ["accel", "ctrl"] }), "an unknown modifier");
		assert.isFalse(registerShortcut({ key: "Enter" }), "a navigation key");
		assert.isFalse(plugin.run(() => Zotero.ShortcutManager.registerShortcut({
			shortcutID: "no-command-test",
			key: "Y",
			modifiers: ["accel", "alt"],
			target: "mainWindow",
		})), "no onCommand");
	});

	it("should reject combos reserved by Zotero but share built-in registrations", function () {
		assert.isFalse(registerShortcut({ key: "W", modifiers: ["accel"] }), "the static list (close tab)");
		// A built-in registration's combo (quicksearch) is not reserved; sharing it fires alongside the built-in
		let sharedID = registerShortcut({ key: "K", modifiers: ["accel", "shift"] });
		assert.isString(sharedID);
		assert.isTrue(unregisterShortcut(sharedID));
		// Built-ins with display-only <key> elements (advanced search) are plain registrations too
		let advancedSearchID = registerShortcut({ shortcutID: "shared-key-element-test", key: "F", modifiers: ["accel", "shift"] });
		assert.isString(advancedSearchID);
	});

	it("should fire every shortcut sharing a combo", function () {
		assert.isString(registerRecorder("first"));
		assert.isString(registerRecorder("second"));
		let event = dispatchKey("y", { accel: true, alt: true });
		assert.deepEqual(calls, ["first", "second"]);
		assert.isTrue(event.defaultPrevented);
	});

	it("should consume the event unless every handler declines", function () {
		registerRecorder("first", {}, true);
		let event = dispatchKey("y", { accel: true, alt: true });
		assert.deepEqual(calls, ["first"]);
		assert.isFalse(event.defaultPrevented, "with every handler declining, the event propagates");

		registerRecorder("second");
		event = dispatchKey("y", { accel: true, alt: true });
		assert.deepEqual(calls, ["first", "first", "second"]);
		assert.isTrue(event.defaultPrevented, "one handling registration consumes it");
	});

	it("should call onCommand with the tab context and consume the event", async function () {
		log.expect("onCommand");
		let shortcutID = registerShortcut();
		assert.isString(shortcutID);
		assert.isFunction(Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID].onCommand);

		let event = dispatchKey("y", { accel: true, alt: true });
		let context = await log.get("onCommand");
		assert.equal(context.tabType, "library");
		assert.equal(context.tabID, "zotero-pane");
		assert.isArray(context.itemIDs);
		assert.isArray(context.collectionIDs);
		assert.isTrue(event.defaultPrevented);

		assert.isTrue(unregisterShortcut(shortcutID));
		assert.isFalse(dispatchKey("y", { accel: true, alt: true }).defaultPrevented, "the combo is free again");
	});

	it("should not fire when the event's default is already prevented", function () {
		registerRecorder("prevented");
		doc.getElementById("zotero-pane").addEventListener("keydown", event => event.preventDefault(), { once: true });
		dispatchKey("y", { accel: true, alt: true });
		assert.isEmpty(calls);
	});

	it("should scope reserved combos to their window target", function () {
		assert.isFalse(registerShortcut({ key: "1", modifiers: ["accel"] }), "tab jumping is reserved in the main window");
		assert.isString(registerShortcut({ key: "1", modifiers: ["accel"], target: "readerWindow" }));
	});

	it("should report combo conflicts via checkShortcut", function () {
		let check = (key, modifiers, target) => plugin.run((key, modifiers, target) => {
			let reasons = Zotero.ShortcutManager.rejectReasons;
			let reason = Zotero.ShortcutManager.checkShortcut({ key, modifiers, target });
			return Object.keys(reasons).find(name => reasons[name] === reason);
		}, key, modifiers, target);
		assert.equal(check("Y", ["accel", "alt"], "mainWindow"), "NONE");
		assert.equal(check("Enter", ["accel"], "mainWindow"), "INVALID");
		assert.equal(check("Y", ["accel"], "main"), "INVALID");
		assert.equal(check("Y", ["accel", "alt"]), "INVALID", "the target is required");
		assert.equal(check("W", ["accel"], "mainWindow"), "RESERVED", "the static list (close tab)");
		assert.equal(check("K", ["accel", "shift"], "mainWindow"), "REGISTERED", "a built-in registration (quicksearch)");
		assert.equal(check("1", ["accel"], "mainWindow"), "RESERVED", "tab jumping is main-window-only");
		assert.equal(check("1", ["accel"], "readerWindow"), "NONE");
	});

	it("should reject an invalid or missing target", function () {
		assert.isFalse(registerShortcut({ target: "main" }));
		assert.isFalse(registerShortcut({ target: ["mainWindow"] }));
		assert.isFalse(plugin.run(() => Zotero.ShortcutManager.registerShortcut({
			shortcutID: "no-target-test",
			key: "Y",
			modifiers: ["accel", "alt"],
			onCommand: () => {},
		})));
	});

	it("should fire in a reader window with the readerWindow target", async function () {
		log.expect("onCommand");
		assert.isString(registerShortcut({ target: "readerWindow" }));
		// The same combo registers separately per target
		assert.isString(registerShortcut({ shortcutID: "main-side-test" }));
		assert.isString(registerRecorder("mainOnly", { key: "E" }));

		let pdfAttachment = await importFileAttachment("test.pdf");
		let { instance: reader } = await Zotero.Reader.open(pdfAttachment.id, undefined, { openInWindow: true });
		await reader._initPromise;
		let readerWin = reader._window;
		let dispatchInReaderWin = (key) => {
			let event = new readerWin.KeyboardEvent("keydown", {
				key,
				metaKey: Zotero.isMac,
				ctrlKey: !Zotero.isMac,
				altKey: true,
				bubbles: true,
				cancelable: true,
			});
			readerWin.document.documentElement.dispatchEvent(event);
			return event;
		};
		try {
			let event = dispatchInReaderWin("y");
			let context = await log.get("onCommand");
			assert.isTrue(event.defaultPrevented);
			assert.equal(context.tabType, "reader");
			assert.equal(context.tabSubType, "pdf");
			assert.isUndefined(context.tabID);
			assert.deepEqual(context.itemIDs, [pdfAttachment.id]);

			let mainOnlyEvent = dispatchInReaderWin("e");
			assert.isEmpty(calls, "a mainWindow shortcut passes through in the reader window");
			assert.isFalse(mainOnlyEvent.defaultPrevented);
		}
		finally {
			reader.close();
		}
	});

	it("should unregister a plugin's shortcuts when it shuts down", async function () {
		assert.isString(registerRecorder("shutdown"));
		assert.isTrue(Zotero.Shortcuts.isRegistered("accel+alt+Y", ["mainWindow"]));

		// What Zotero does on the plugin's shutdown
		await Zotero.ShortcutManager._shortcutManager._unregisterByPluginID(plugin.id);
		assert.isFalse(Zotero.Shortcuts.isRegistered("accel+alt+Y", ["mainWindow"]));
		assert.isFalse(dispatchKey("y", { accel: true, alt: true }).defaultPrevented);
		assert.isEmpty(calls);
	});

	it("should support the literal control modifier", function () {
		assert.isString(registerRecorder("control", { key: "J", modifiers: ["control"] }));
		// ctrlKey maps to control on mac and to accel (folded) elsewhere, so the same physical Ctrl+J fires everywhere
		let event = dispatchKey("j", { ctrl: true });
		assert.deepEqual(calls, ["control"]);
		assert.isTrue(event.defaultPrevented);
	});

	it("should match letters by the layout-aware keyCode when event.key diverges", function () {
		registerRecorder("latin");
		// Y
		let dispatch = key => dispatchKey(key, { accel: true, alt: true, keyCode: 89 });

		// mac Option composes event.key (alt+Y gives "¥" on a US layout), while keyCode keeps the unshifted Latin letter
		assert.isTrue(dispatch("¥").defaultPrevented);
		assert.deepEqual(calls, ["latin"]);
		// A non-Latin layout's event.key (Cyrillic on the Y key of a Russian layout); Gecko latinizes keyCode
		assert.isTrue(dispatch("н").defaultPrevented);
		assert.deepEqual(calls, ["latin", "latin"]);

		// Both interpretations fire, as combos share
		registerRecorder("composed", { key: "¥" });
		dispatch("¥");
		assert.sameMembers(calls.slice(2), ["latin", "composed"]);
	});

	it("should match digit combos by physical key", async function () {
		log.expect("onCommand");
		registerShortcut({ key: "5" });
		let event = dispatchKey("∞", { accel: true, alt: true, code: "Digit5" });
		await log.get("onCommand");
		assert.isTrue(event.defaultPrevented);
	});

	// A bogus pluginID would name no loaded plugin, which the managers take for first-party chrome
	it("should not let an accessor pluginID override the real caller", function () {
		let shortcutID = plugin.run(() => {
			let options = { shortcutID: "accessor-spoof-shortcut", key: "U", modifiers: ["accel", "alt"], target: "mainWindow", onCommand: () => {} };
			Object.defineProperty(options, "pluginID", {
				get: () => "nonexistent-privileged@evil",
				set: () => {},
				enumerable: true,
				configurable: true,
			});
			return Zotero.ShortcutManager.registerShortcut(options);
		});
		assert.isString(shortcutID);
		assert.equal(Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID].pluginID, plugin.id);
	});

	it("should not let a Proxy options object override the real caller", function () {
		let shortcutID = plugin.run(() => Zotero.ShortcutManager.registerShortcut(new Proxy(
			{ shortcutID: "proxy-spoof-shortcut", key: "U", modifiers: ["accel", "alt"], target: "mainWindow", onCommand: () => {} },
			{
				get: (target, prop) => (prop === "pluginID" ? "nonexistent-privileged@evil" : target[prop]),
				set: () => true,
			}
		)));
		assert.isString(shortcutID);
		assert.equal(Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID].pluginID, plugin.id);
	});

	it("should not unregister another plugin's shortcut", function () {
		other.load(["default", "shortcut"]);
		let shortcutID = other.run(() => Zotero.ShortcutManager.registerShortcut({
			shortcutID: "other-plugin-shortcut",
			key: "U",
			modifiers: ["accel", "alt"],
			target: "mainWindow",
			onCommand: () => {},
		}));
		assert.isString(shortcutID);
		assert.isFalse(unregisterShortcut(shortcutID));
		assert.exists(Zotero.ShortcutManager._shortcutManager._optionsCache[shortcutID]);
	});

	it("should not be exposed without the shortcut permission", function () {
		plugin.load(["default"]);
		assert.equal(plugin.run(() => typeof Zotero.ShortcutManager), "undefined");
	});

	it("should be exposed via the ui umbrella permission", function () {
		plugin.load(["default", "ui"]);
		assert.equal(plugin.run(() => typeof Zotero.ShortcutManager.registerShortcut), "function");
	});
});
