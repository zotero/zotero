describe("Zotero.WindowController", function () {
	var plugin = usePluginSandbox();
	var privileged = usePluginSandbox({ id: "test-window-privileged@zotero.org" });
	var { WindowUtils } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/window.mjs");
	var { PluginRequestError } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/apiErrors.mjs");
	var codes = Zotero.WindowController.errorCodes;
	var win, doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane, windowID;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		ZoteroContextPane = win.ZoteroContextPane;
		windowID = win.browsingContext.id;
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		plugin.load(["default", "window"]);
	});

	// A request from the plugin's sandbox, its response as plain data
	function query(name, params, caller = plugin) {
		return caller.run((name, params) => Zotero.WindowController.query(name, params), name, params);
	}

	function command(name, params, caller = plugin) {
		return caller.run((name, params) => Zotero.WindowController.command(name, params), name, params);
	}

	async function waitForClosed(closingWin) {
		await waitForCallback(() => closingWin.closed, 20, 2);
	}

	it("should list the main window with a resolvable window ID", async function () {
		let { windows } = await requestResult(query("windows", { type: "mainWindow" }));
		let info = windows.find(w => w.windowID === windowID);
		assert.ok(info, "the test window is listed");
		assert.equal(info.type, "mainWindow");
		assert.equal(info.title, doc.title);
		assert.isBoolean(info.focused);
		assert.strictEqual(WindowUtils.getWindow(info.windowID, "mainWindow"), win);
	});

	it("should list every window type when no type is given", async function () {
		let windowTypes = plugin.run(() => Array.from(Zotero.WindowController.windowTypes));
		let { windows } = await requestResult(query("windows"));
		assert.isTrue(windows.some(w => w.type === "mainWindow"));
		assert.isTrue(windows.every(w => windowTypes.includes(w.type)));
	});

	it("should fail an unknown window type", async function () {
		await requestError(query("windows", { type: "popup" }), codes.INVALID_PARAMS);
	});

	it("should not open a plugin window for a privileged plugin", async function () {
		// A plugin window shows an unprivileged plugin's own page
		privileged.load(["*"]);
		await requestError(command("openPluginWindow", { url: "page.html" }, privileged), codes.NOT_ALLOWED);
	});

	it("should list plugin windows with their owner and hide them from other plugins", async function () {
		const OWNER = "window-owner@zotero.org";
		let pluginWin = Services.ww.openWindow(
			null, "chrome://zotero/content/pluginWindow.xhtml", null,
			"chrome,dialog=no,resizable,width=300,height=200", { notitle: false }
		);
		await new Promise(resolve => pluginWin.addEventListener("load", resolve, { once: true }));
		pluginWin.PluginWindow.init("owned", OWNER);
		let pluginWindowID = pluginWin.browsingContext.id;
		try {
			// A privileged plugin sees every plugin window, with its owner
			privileged.load(["*"]);
			let { windows } = await requestResult(query("windows", { type: "pluginWindow" }, privileged));
			let info = windows.find(w => w.windowID === pluginWindowID);
			assert.equal(info.type, "pluginWindow");
			assert.equal(info.pluginID, OWNER);

			// Another unprivileged plugin neither lists nor reaches it, as for an unknown ID
			({ windows } = await requestResult(query("windows", { type: "pluginWindow" })));
			assert.isFalse(windows.some(w => w.windowID === pluginWindowID), "another plugin's window is not listed");
			await requestError(query("getWindowState", { windowID: pluginWindowID }), codes.NOT_FOUND);
			await requestError(command("focusWindow", { windowID: pluginWindowID }), codes.NOT_FOUND);
			await requestError(command("closeWindow", { windowID: pluginWindowID }), codes.NOT_FOUND);

			await requestResult(command("closeWindow", { windowID: pluginWindowID }, privileged));
			await waitForClosed(pluginWin);
		}
		finally {
			if (!pluginWin.closed) {
				pluginWin.close();
			}
		}
	});

	it("should focus a window by ID", async function () {
		let focus = sinon.stub(win, "focus");
		try {
			assert.deepEqual(await requestResult(command("focusWindow", { windowID })), {});
			assert.isTrue(focus.calledOnce);
		}
		finally {
			focus.restore();
		}
	});

	it("should fail focusing an unknown window or without an ID", async function () {
		await requestError(command("focusWindow", { windowID: -1 }), codes.NOT_FOUND);
		await requestError(command("focusWindow"), codes.INVALID_PARAMS);
	});

	it("should report a window's size mode, focus, position and size", async function () {
		let state = await requestResult(query("getWindowState", { windowID }));
		assert.include(["normal", "minimized", "maximized", "fullscreen"], state.sizeMode);
		assert.isBoolean(state.focused);
		assert.deepEqual([state.x, state.y, state.width, state.height], [win.screenX, win.screenY, win.outerWidth, win.outerHeight]);
		assert.sameMembers(Object.keys(state), ["sizeMode", "focused", "x", "y", "width", "height"]);
		await requestError(query("getWindowState", { windowID: -1 }), codes.NOT_FOUND);
		await requestError(query("getWindowState"), codes.INVALID_PARAMS);
	});

	describe("panes", function () {
		var controller = Zotero.WindowController._windowController;

		beforeEach(function () {
			Zotero_Tabs.select("zotero-pane");
		});

		it("should toggle a main window's panes and report the new state", async function () {
			for (let pane of ["start", "end"]) {
				let { open: before } = controller._getPaneState(win, pane);
				let { open } = await requestResult(command("togglePane", { windowID, pane }));
				assert.equal(open, !before, `${pane} toggled`);
				assert.deepEqual(controller._getPaneState(win, pane), { open }, `${pane} state`);
				({ open } = await requestResult(command("togglePane", { windowID, pane })));
				assert.equal(open, before, `${pane} restored`);
			}
		});

		it("should report the window's layout state", async function () {
			let state = await requestResult(query("getLayoutState", { windowID }));
			assert.sameMembers(Object.keys(state.panes), ["start", "end"]);
			for (let pane of ["start", "end"]) {
				assert.isBoolean(state.panes[pane].open, pane);
				assert.deepEqual(state.panes[pane], controller._getPaneState(win, pane), pane);
			}
			await requestError(query("getLayoutState", { windowID: -1 }), codes.NOT_FOUND);
		});

		it("should put a pane in the given state when open is passed", async function () {
			let initial = await requestResult(query("getLayoutState", { windowID }));
			let set = async (pane, open) => (await requestResult(command("togglePane", { windowID, pane, open }))).open;
			for (let pane of ["start", "end"]) {
				assert.isTrue(await set(pane, true), `${pane} opened`);
				// Asking for the state it's already in leaves it alone
				assert.isTrue(await set(pane, true), `${pane} still open`);
				assert.isFalse(await set(pane, false), `${pane} closed`);
				assert.isFalse(await set(pane, false), `${pane} still closed`);
				await set(pane, initial.panes[pane].open);
			}
		});

		it("should toggle the item pane in a library tab and the context pane in other tabs", async function () {
			let toggle = async () => (await requestResult(command("togglePane", { windowID, pane: "end" }))).open;

			// Library tab: the right-hand pane is ZoteroPane's own item pane
			let itemPaneOpen = !ZoteroPane.itemPane.collapsed;
			let contextPaneOpen = !ZoteroContextPane.collapsed;
			assert.equal(await toggle(), !itemPaneOpen, "the item pane toggles in the library tab");
			assert.equal(!ZoteroPane.itemPane.collapsed, !itemPaneOpen);
			assert.equal(!ZoteroContextPane.collapsed, contextPaneOpen, "the context pane is untouched in the library tab");
			await toggle();

			// Reader tab: the right-hand pane is the shared context pane
			let attachment = await importFileAttachment("test.pdf");
			let { instance: reader } = await Zotero.Reader.open(attachment.id);
			await reader._initPromise;
			try {
				itemPaneOpen = !ZoteroPane.itemPane.collapsed;
				contextPaneOpen = !ZoteroContextPane.collapsed;
				assert.equal(await toggle(), !contextPaneOpen, "the context pane toggles in a reader tab");
				assert.equal(!ZoteroContextPane.collapsed, !contextPaneOpen);
				assert.equal(!ZoteroPane.itemPane.collapsed, itemPaneOpen, "the item pane is untouched in a reader tab");
				await toggle();
			}
			finally {
				Zotero_Tabs.close(reader.tabID);
				Zotero_Tabs.select("zotero-pane");
			}
		});

		it("should toggle the collections pane in a library tab and the reader's sidebar in a reader tab", async function () {
			let toggle = async () => (await requestResult(command("togglePane", { windowID, pane: "start" }))).open;
			let collectionsPane = doc.getElementById("zotero-collections-pane");
			let collectionsPaneOpen = () => !collectionsPane.hasAttribute("collapsed");

			let open = collectionsPaneOpen();
			assert.equal(await toggle(), !open, "the collections pane toggles");
			assert.equal(collectionsPaneOpen(), !open);
			await toggle();
			assert.equal(collectionsPaneOpen(), open, "the collections pane is restored");

			// Reader tab: the left pane is the reader's own sidebar, whose state Zotero_Tabs keeps per tab type
			let attachment = await importFileAttachment("test.pdf");
			let { instance: reader } = await Zotero.Reader.open(attachment.id);
			await reader._initPromise;
			try {
				open = Zotero_Tabs.getSidebarState("reader").open;
				let libraryPaneOpen = collectionsPaneOpen();
				assert.equal(await toggle(), !open, "the reader sidebar toggles");
				assert.equal(Zotero_Tabs.getSidebarState("reader").open, !open);
				assert.equal(collectionsPaneOpen(), libraryPaneOpen, "the collections pane is untouched");
				assert.equal(await toggle(), open, "the reader sidebar is restored");
			}
			finally {
				Zotero_Tabs.close(reader.tabID);
				Zotero_Tabs.select("zotero-pane");
			}
		});

		it("should fail toggling an unknown pane or a pane of an unknown window", async function () {
			await requestError(command("togglePane", { windowID, pane: "nope" }), codes.INVALID_PARAMS);
			await requestError(command("togglePane", { windowID: -1, pane: "end" }), codes.NOT_FOUND);
		});
	});

	it("should open a note and a reader in their own windows, reuse an open one, and close any window type", async function () {
		let note = await createDataObject("item", { itemType: "note" });
		let attachment = await importFileAttachment("test.pdf");
		let opened = [];
		try {
			let { windowID: noteWindowID } = await requestResult(command("openWindow", { type: "note", itemID: note.id }));
			let noteWin = WindowUtils.getWindow(noteWindowID, "noteWindow");
			opened.push(noteWin);
			assert.equal(noteWin.name, "zotero-note-" + note.id);
			let { windows } = await requestResult(query("windows", { type: "noteWindow" }));
			assert.equal(windows.find(w => w.windowID === noteWindowID).itemID, note.id);
			let again = await requestResult(command("openWindow", { type: "note", itemID: note.id }));
			assert.equal(again.windowID, noteWindowID, "an open note window is reused");

			let { windowID: readerWindowID } = await requestResult(command("openWindow", { type: "reader", itemID: attachment.id }));
			let readerWin = WindowUtils.getWindow(readerWindowID, "readerWindow");
			opened.push(readerWin);
			assert.equal(readerWin.reader.itemID, attachment.id);
			({ windows } = await requestResult(query("windows", { type: "readerWindow" })));
			assert.equal(windows.find(w => w.windowID === readerWindowID).itemID, attachment.id);
			again = await requestResult(command("openWindow", { type: "reader", itemID: attachment.id }));
			assert.equal(again.windowID, readerWindowID, "an open reader window is reused");

			// Not limited to the plugin's own windows
			await requestResult(command("closeWindow", { windowID: readerWindowID }));
			await waitForClosed(readerWin);
			await requestResult(command("closeWindow", { windowID: noteWindowID }));
			await waitForClosed(noteWin);

			await requestError(command("openWindow", { type: "note", itemID: -1 }), codes.NOT_FOUND);
			await requestError(command("openWindow", { type: "reader", itemID: note.id }), codes.INVALID_PARAMS);
			await requestError(command("openWindow", { type: "library", itemID: note.id }), codes.INVALID_PARAMS);
		}
		finally {
			for (let opener of opened) {
				if (!opener.closed) {
					opener.close();
				}
			}
		}
	});

	it("should open the preferences on a pane, reusing an open window", async function () {
		// The command does not wait for the pane to show
		let waitForPane = (prefsWin, pane) => waitForCallback(
			() => prefsWin.Zotero_Preferences?.navigation?.value === pane, 20, 2);
		let { windowID: prefsWindowID } = await requestResult(command("openWindow", {
			type: "preferencePane",
			location: { pane: "zotero-prefpane-advanced" },
		}));
		let prefsWin = WindowUtils.getWindow(prefsWindowID, "preferencePane");
		try {
			await waitForPane(prefsWin, "zotero-prefpane-advanced");
			let again = await requestResult(command("openWindow", {
				type: "preferencePane",
				location: { pane: "zotero-prefpane-general" },
			}));
			assert.equal(again.windowID, prefsWindowID, "an open preferences window is reused");
			await waitForPane(prefsWin, "zotero-prefpane-general");
			let { windows } = await requestResult(query("windows", { type: "preferencePane" }));
			assert.isTrue(windows.some(w => w.windowID === prefsWindowID));

			await requestError(command("openWindow", { type: "preferencePane", location: { pane: "nope" } }), codes.NOT_FOUND);
			await requestError(command("openWindow", { type: "note" }), codes.INVALID_PARAMS);
		}
		finally {
			prefsWin.close();
		}
	});

	it("should resolve a query to a plain object of the plugin's own compartment", async function () {
		assert.isTrue(await plugin.run(async () => {
			let response = await Zotero.WindowController.query("windows", { type: "mainWindow" });
			let { result } = response;
			return Object.getPrototypeOf(response) === Object.prototype
				&& response.success === true && !("error" in response)
				&& Object.getPrototypeOf(result) === Object.prototype
				&& Array.isArray(result.windows)
				&& result.windows.every(w => typeof w.windowID === "number" && w.type === "mainWindow");
		}));
	});

	it("should resolve a failure with its code and message instead of rejecting", async function () {
		assert.deepEqual(await query("nope"), {
			success: false,
			result: {},
			error: { code: "UnknownRequest", message: "Unknown query 'nope'" },
		});
	});

	describe("exposure", function () {
		it("should not expose either controller without the window or tab permission", function () {
			plugin.load(["default"]);
			assert.deepEqual(plugin.run(() => [typeof Zotero.WindowController, typeof Zotero.TabController]), ["undefined", "undefined"]);
		});

		it("should expose WindowController with window, and TabController only with tab, which implies window", function () {
			assert.deepEqual(plugin.run(() => ({
				query: typeof Zotero.WindowController.query,
				command: typeof Zotero.WindowController.command,
				mainWindow: Zotero.WindowController.windowTypes.includes("mainWindow"),
				tab: typeof Zotero.TabController,
			})), { query: "function", command: "function", mainWindow: true, tab: "undefined" });

			plugin.load(["default", "tab"]);
			assert.deepEqual(plugin.run(() => [
				typeof Zotero.WindowController.query,
				typeof Zotero.TabController.query,
				typeof Zotero.TabController.command,
			]), ["function", "function", "function"]);
		});

		it("should expose both controllers via the ui umbrella permission", function () {
			plugin.load(["default", "ui"]);
			assert.deepEqual(plugin.run(() => [typeof Zotero.WindowController.command, typeof Zotero.TabController.command]),
				["function", "function"]);
		});

		it("should not expose the internal instances", function () {
			plugin.load(["default", "tab"]);
			assert.deepEqual(plugin.run(() => [typeof Zotero.WindowController._windowController, typeof Zotero.TabController._tabController]),
				["undefined", "undefined"]);
		});

		it("should hand out one wrapper per request method", function () {
			plugin.load(["default", "tab"]);
			assert.isTrue(plugin.run(() => {
				let { query } = Zotero.WindowController;
				let { command } = Zotero.TabController;
				return query === Zotero.WindowController.query && command === Zotero.TabController.command;
			}));
		});
	});

	// The window lookups every controller request goes through
	describe("WindowUtils", function () {
		it("should reject an unknown or mistyped window ID", function () {
			let e = assert.throws(() => WindowUtils.getWindow(-1), /No window with ID/);
			assert.instanceOf(e, PluginRequestError);
			assert.equal(e.code, codes.NOT_FOUND);
			e = assert.throws(() => WindowUtils.getWindow(windowID, "readerWindow"), /is not a readerWindow/);
			assert.equal(e.code, codes.NOT_FOUND);
			assert.throws(() => WindowUtils.getMainWindow(-1), /No window with ID/);
			assert.strictEqual(WindowUtils.getMainWindow(windowID), win);
		});

		it("should let only its owner reach a plugin window", async function () {
			const OWNER = "window-owner@zotero.org";
			let pluginWin = Services.ww.openWindow(
				null, "chrome://zotero/content/pluginWindow.xhtml", null,
				"chrome,dialog=no,resizable,width=300,height=200", { notitle: false }
			);
			await new Promise(resolve => pluginWin.addEventListener("load", resolve, { once: true }));
			pluginWin.PluginWindow.init("owned", OWNER);
			let pluginWindowID = pluginWin.browsingContext.id;
			try {
				assert.strictEqual(WindowUtils.getWindow(pluginWindowID, "pluginWindow"), pluginWin);
				assert.strictEqual(WindowUtils.getWindow(pluginWindowID, undefined, OWNER), pluginWin);
				let e = assert.throws(() => WindowUtils.getWindow(pluginWindowID, undefined, "other@zotero.org"), /No window with ID/);
				assert.equal(e.code, codes.NOT_FOUND, "another plugin gets NotFound, as for an unknown ID");
				assert.strictEqual(WindowUtils.getWindow(windowID, "mainWindow", "other@zotero.org"), win,
					"ownership only applies to plugin windows");
			}
			finally {
				pluginWin.close();
			}
		});
	});
});
