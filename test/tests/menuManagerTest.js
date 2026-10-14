describe("Zotero.MenuManager", function () {
	var plugin = usePluginSandbox();
	var log = createCallbackLog();
	var win, doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane;

	// What every hook's context carries, then what a main window tab adds; the live objects only a privileged
	// plugin gets are stripped from an unprivileged one's
	const HOOK_KEYS = ["setEnabled", "setIcon", "setL10nArgs", "setVisible"];
	const TAB_KEYS = ["tabID", "tabType", "tabSubType"];

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		ZoteroContextPane = win.ZoteroContextPane;
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		log.reset();
		plugin.load(["default", "menu"]);
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		Zotero_Tabs.select("zotero-pane");
		Zotero_Tabs.closeAll();
		await Zotero.MenuManager._menuManager._unregisterByPluginID(plugin.id);
	});

	function menuItem(popup, l10nID) {
		return popup.querySelector(`.zotero-custom-menu-item[data-l10n-id="${l10nID}"]`);
	}

	// Open the popup a selector names through its popupshowing/popupshown events
	function openBySelector(selector, targetDoc = doc) {
		return async () => {
			let popup = targetDoc.querySelector(selector);
			await simulateMenuOpen(popup);
			return { popup, close: () => simulateMenuClosed(popup) };
		};
	}

	// Open a popup the way its UI does, closing it with hidePopup
	function openWith(open) {
		return async () => {
			let popup = await open();
			return { popup, close: () => popup.hidePopup() };
		};
	}

	// Register an item on the target, open its popup, and check the keys its onShowing context has
	async function checkContext(target, open, keys = []) {
		log.expect("onShowing");
		let menuID = plugin.run(target => Zotero.MenuManager.registerMenu({
			menuID: "context-test",
			target,
			menus: [{
				menuType: "menuitem",
				l10nID: "menu-print",
				onShowing: context => report("onShowing", Object.keys(context)),
			}],
		}), target);
		assert.isString(menuID, target);
		let { popup, close } = await open();
		assert.exists(popup, `the popup of ${target}`);
		assert.includeMembers(await log.get("onShowing"), [...HOOK_KEYS, ...keys], target);
		await close();
		assert.isTrue(plugin.run(menuID => Zotero.MenuManager.unregisterMenu(menuID), menuID));
	}

	it("should register a menu item and call its hooks", async function () {
		for (let hook of ["onShowing", "onShown", "onHiding", "onHidden", "onCommand"]) {
			log.expect(hook);
		}
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "hooks-test",
			target: "main/menubar/file",
			menus: [{
				menuType: "menuitem",
				l10nID: "test-menu-hooks",
				// An unprivileged hook gets the context alone
				onShowing: () => report("onShowing"),
				onShown: () => report("onShown"),
				onHiding: () => report("onHiding"),
				onHidden: () => report("onHidden"),
				onCommand: ({ tabType }) => report("onCommand", tabType),
			}],
		}));
		assert.isString(menuID);

		let popup = doc.querySelector("#menu_FilePopup");
		await simulateMenuOpen(popup);
		await log.get("onShowing");
		await log.get("onShown");
		let elem = menuItem(popup, "test-menu-hooks");
		assert.exists(elem);
		await simulateMenuItemClick(elem);
		assert.equal(await log.get("onCommand"), "library");
		await simulateMenuClosed(popup);
		await log.get("onHiding");
		await log.get("onHidden");

		assert.isTrue(plugin.run(menuID => Zotero.MenuManager.unregisterMenu(menuID), menuID));
		// The listener runs before the dispatched events return
		popup.addEventListener("popupshown", () => {
			assert.notExists(popup.querySelector(".zotero-custom-menu-item"));
		}, { once: true });
		await simulateMenuOpen(popup);
		await simulateMenuClosed(popup);
	});

	it("should hide a menu item outside the tab types it is enabled for", async function () {
		let types = {
			library: ["library"],
			pdf: ["reader/pdf"],
			epub: ["reader/epub"],
			snapshot: ["reader/snapshot"],
			anyReader: ["reader/*"],
			// Same as "reader/*", as for buttons
			bareReader: ["reader"],
			pdfOrAnyReader: ["reader/pdf", "reader/*"],
		};
		plugin.run(types => Zotero.MenuManager.registerMenu({
			menuID: "tab-type-test",
			target: "main/menubar/file",
			menus: Object.entries(types).map(([name, enableForTabTypes]) => ({
				menuType: "menuitem",
				l10nID: "test-menu-" + name,
				enableForTabTypes,
			})),
		}), types);
		let popup = doc.querySelector("#menu_FilePopup");

		async function checkVisible(visible) {
			await simulateMenuOpen(popup);
			for (let name of Object.keys(types)) {
				assert.equal(!menuItem(popup, "test-menu-" + name).hidden, visible.includes(name),
					`${name} is ${visible.includes(name) ? "shown" : "hidden"}`);
			}
			await simulateMenuClosed(popup);
		}

		let readers = ["anyReader", "bareReader", "pdfOrAnyReader"];
		await checkVisible(["library"]);
		for (let [file, type] of [["test.pdf", "pdf"], ["stub.epub", "epub"], ["test.html", "snapshot"]]) {
			let attachment = await importFileAttachment(file);
			await ZoteroPane.viewItems([attachment]);
			await Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)._initPromise;
			await checkVisible([type, ...readers]);
		}
	});

	it("should register a recursive submenu, calling the child's hooks only once it opens", async function () {
		log.expect("onShowing");
		log.expect("onCommand");
		plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "submenu-test",
			target: "main/menubar/file",
			menus: [{
				menuType: "submenu",
				l10nID: "test-submenu",
				menus: [{
					menuType: "menuitem",
					l10nID: "test-submenu-item",
					onShowing: () => report("onShowing"),
					onCommand: () => report("onCommand"),
				}],
			}],
		}));
		let popup = doc.querySelector("#menu_FilePopup");
		await simulateMenuOpen(popup);
		let submenu = menuItem(popup, "test-submenu");
		assert.exists(submenu);
		let reported = false;
		log.get("onShowing").then(() => reported = true);
		await Zotero.Promise.delay(0);
		assert.isFalse(reported, "the child's onShowing waits for its own popup");

		let submenuPopup = submenu.querySelector("menupopup");
		await simulateMenuOpen(submenuPopup);
		await log.get("onShowing");
		await simulateMenuItemClick(menuItem(submenuPopup, "test-submenu-item"));
		await log.get("onCommand");
		await simulateMenuClosed(submenuPopup);
		await simulateMenuClosed(popup);
	});

	it("should register main window menubar menus", async function () {
		for (let [target, selector] of Object.entries({
			"main/menubar/file": "#menu_FilePopup",
			"main/menubar/edit": "#menu_EditPopup",
			"main/menubar/view": "#menu_viewPopup",
			"main/menubar/go": "#menu_goPopup",
			"main/menubar/tools": "#menu_ToolsPopup",
			"main/menubar/help": "#menu_HelpPopup",
		})) {
			await checkContext(target, openBySelector(selector), [...TAB_KEYS, "itemIDs"]);
		}
	});

	it("should register library menus", async function () {
		await checkContext("main/library/item", openWith(() => {
			ZoteroPane.onItemsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
			return doc.querySelector("#zotero-itemmenu");
		}), [...TAB_KEYS, "itemIDs", "libraryIDs", "collectionIDs"]);
		await checkContext("main/library/collection", openWith(() => {
			ZoteroPane.onCollectionsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
			return doc.querySelector("#zotero-collectionmenu");
		}), [...TAB_KEYS, "libraryIDs", "collectionIDs"]);
		await checkContext("main/library/addAttachment", openBySelector("#menu_attachmentAdd > menupopup"), [...TAB_KEYS, "itemIDs"]);
		await checkContext("main/library/addNote", openBySelector("#menu_noteAdd > menupopup"), [...TAB_KEYS, "itemIDs"]);
	});

	it("should register other main window menus", async function () {
		await checkContext("main/tab", openWith(() => Zotero_Tabs._openMenu(0, 0, Zotero_Tabs.selectedID)), [...TAB_KEYS, "itemIDs"]);
		await checkContext("itemPane/info/row", openWith(async () => {
			let item = await createDataObject("item");
			await ZoteroPane.selectItem(item.id);
			let infoBox = ZoteroPane.itemPane._itemDetails.getPane("info");
			let row = infoBox.querySelector("#itembox-field-value-title");
			row.focus();
			row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
			return infoBox.querySelector("#zotero-field-menu");
		}), [...TAB_KEYS, "itemIDs", "editable", "fieldName"]);
		await checkContext("sidenav/locate", openWith(async () => {
			let item = await createDataObject("item");
			await ZoteroPane.selectItem(item.id);
			let button = ZoteroPane.itemPane._sidenav.querySelector("toolbarbutton[data-action='locate']");
			button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
			return button.querySelector("menupopup");
		}), [...TAB_KEYS, "itemIDs"]);
	});

	it("should register note context menus", async function () {
		let item = await createDataObject("item");
		let pdfItem = await importFileAttachment("test.pdf", { parentItemID: item.id });
		await ZoteroPane.viewItems([pdfItem]);
		await Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)._initPromise;
		ZoteroContextPane.collapsed = false;
		ZoteroContextPane.sidenav._contextNotesPaneVisible = true;
		let notesContext = ZoteroContextPane.context._getCurrentNotesContext();
		let openAddNote = (listSelector, popupSelector) => openWith(() => {
			let button = notesContext.notesList.querySelector(`${listSelector} .section-custom-button.add`);
			button.dispatchEvent(new MouseEvent("command", { bubbles: true, cancelable: true }));
			return notesContext.querySelector(popupSelector);
		});
		await checkContext("notesPane/addItemNote",
			openAddNote(".item-notes", ".context-pane-add-child-note-button-popup"), TAB_KEYS);
		await checkContext("notesPane/addStandaloneNote",
			openAddNote(".all-notes", ".context-pane-add-standalone-note-button-popup"), TAB_KEYS);
	});

	it("should register reader window menubar menus", async function () {
		let pdfAttachment = await importFileAttachment("test.pdf");
		let { instance: reader } = await Zotero.Reader.open(pdfAttachment.id, undefined, { openInWindow: true });
		await reader._initPromise;
		try {
			for (let [target, selector] of Object.entries({
				"reader/menubar/file": "#menu_FilePopup",
				"reader/menubar/edit": "#menu_EditPopup",
				"reader/menubar/view": "#menu_viewPopup",
				"reader/menubar/go": "#menu_goPopup",
				"reader/menubar/window": "#windowPopup",
			})) {
				// A reader window has no tab
				await checkContext(target, openBySelector(selector, reader._window.document), ["itemIDs", "tabType", "tabSubType"]);
			}
		}
		finally {
			reader.close();
		}
	});

	it("should remove a plugin's menu elements when it shuts down", async function () {
		log.expect("onShowing");
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "shutdown-test",
			target: "main/menubar/file",
			menus: [{ menuType: "menuitem", l10nID: "menu-print", onShowing: () => report("onShowing") }],
		}));
		let popup = doc.querySelector("#menu_FilePopup");
		await simulateMenuOpen(popup);
		await log.get("onShowing");
		let selector = `.zotero-custom-menu-item.${CSS.escape(menuID)}`;
		assert.exists(popup.querySelector(selector));
		await simulateMenuClosed(popup);

		// What Zotero does on the plugin's shutdown
		await Zotero.MenuManager._menuManager._unregisterByPluginID(plugin.id);
		assert.notExists(popup.querySelector(selector));
	});

	it("should group a large number of menu items into a submenu", async function () {
		plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "group-test",
			target: "main/library/item",
			menus: Array.from({ length: 100 }, () => ({ menuType: "menuitem", l10nID: "menu-print" })),
		}));
		let popup = doc.querySelector("#zotero-itemmenu");
		let shown = new Promise(resolve => popup.addEventListener("popupshown", resolve, { once: true }));
		ZoteroPane.onItemsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
		await shown;
		assert.exists(popup.querySelector(".zotero-custom-menu-group-submenu"));
		popup.hidePopup();
	});

	it("should store a menu's hooks wrapped for the sandbox", function () {
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "sandbox-menu",
			target: "main/library/item",
			menus: [{
				menuType: "menuitem",
				l10nID: "general-print",
				onCommand: () => "sandbox-command",
				onShowing: () => "sandbox-showing",
			}],
		}));
		let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
		assert.isFunction(option.menus[0].onCommand);
		assert.isFunction(option.menus[0].onShowing);
		assert.isTrue(plugin.run(menuID => Zotero.MenuManager.unregisterMenu(menuID), menuID));
		assert.notExists(Zotero.MenuManager._menuManager._optionsCache[menuID]);
	});

	// A bogus pluginID would name no loaded plugin, which the managers take for first-party chrome
	it("should not let an accessor pluginID override the real caller", function () {
		let menuID = plugin.run(() => {
			let options = {
				menuID: "accessor-spoof-menu",
				target: "main/library/item",
				menus: [{ menuType: "menuitem", l10nID: "general-print", onCommand: () => {} }],
			};
			Object.defineProperty(options, "pluginID", {
				get: () => "nonexistent-privileged@evil",
				set: () => {},
				enumerable: true,
				configurable: true,
			});
			return Zotero.MenuManager.registerMenu(options);
		});
		assert.isString(menuID);
		assert.equal(Zotero.MenuManager._menuManager._optionsCache[menuID].pluginID, plugin.id);
	});

	it("should not let a Proxy options object override the real caller", function () {
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu(new Proxy({
			menuID: "proxy-spoof-menu",
			target: "main/library/item",
			menus: [{ menuType: "menuitem", l10nID: "general-print", onCommand: () => {} }],
		}, {
			get: (target, prop) => (prop === "pluginID" ? "nonexistent-privileged@evil" : target[prop]),
			set: () => true,
		})));
		assert.isString(menuID);
		assert.equal(Zotero.MenuManager._menuManager._optionsCache[menuID].pluginID, plugin.id);
	});

	// Privileged plugins keep both
	it("should strip the DOM event and context.menuElem from unprivileged hooks", function () {
		log.expect("onCommand");
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "sandbox-restrict-menu",
			target: "main/library/item",
			menus: [{
				menuType: "menuitem",
				l10nID: "general-print",
				onCommand: function (context) {
					report("onCommand", {
						argCount: arguments.length,
						hasMenuElem: "menuElem" in context,
						itemID: context.itemIDs[0],
					});
				},
			}],
		}));
		// Called as MenuManager does, with a chrome event placeholder and a menuElem in the context
		let onCommand = Zotero.MenuManager._menuManager._optionsCache[menuID].menus[0].onCommand;
		onCommand(null, { menuElem: doc.createElement("menuitem"), itemIDs: [123] });
		return log.get("onCommand").then((result) => {
			assert.deepEqual(result, { argCount: 1, hasMenuElem: false, itemID: 123 });
		});
	});

	describe("plugin windows", function () {
		const CONTEXT_TARGET = "pluginWindow/shared/context";
		const FILE_TARGET = "pluginWindow/shared/menubar/file";
		var other = usePluginSandbox({ id: "plugin-window-other@zotero.org" });
		var pluginWindow;

		before(async function () {
			pluginWindow = Services.ww.openWindow(
				null, "chrome://zotero/content/pluginWindow.xhtml", null,
				"chrome,dialog=no,resizable,width=300,height=200", { notitle: false }
			);
			await new Promise(resolve => pluginWindow.addEventListener("load", resolve, { once: true }));
			// Two plugins picked the same window name; the window belongs to the test plugin
			pluginWindow.PluginWindow.init("shared", plugin.id);
		});

		after(function () {
			pluginWindow.close();
		});

		beforeEach(function () {
			other.load(["default", "menu"]);
			let register = (target, l10nID) => Zotero.MenuManager.registerMenu({
				menuID: l10nID,
				target,
				menus: [{ menuType: "menuitem", l10nID }],
			});
			plugin.run(register, CONTEXT_TARGET, "owner-context");
			other.run(register, CONTEXT_TARGET, "other-context");
			other.run(register, FILE_TARGET, "other-file");
		});

		afterEach(async function () {
			await Zotero.MenuManager._menuManager._unregisterByPluginID(other.id);
		});

		it("should scope a target's menus to the owning plugin", function () {
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET), "an unscoped lookup sees every plugin");
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, plugin.id));
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, other.id));
			assert.isFalse(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, "nobody@zotero.org"));
			assert.isFalse(Zotero.MenuManager.hasMenus(FILE_TARGET, plugin.id));
		});

		it("should show only the owning plugin's items in its window", function () {
			let popup = pluginWindow.document.getElementById("pluginContentContextMenu");
			popup.dispatchEvent(new pluginWindow.Event("popupshowing"));
			let items = Array.from(popup.querySelectorAll(".zotero-custom-menu-item"));
			assert.deepEqual(items.map(item => item.dataset.l10nId), ["owner-context"]);
			// The other plugin's File registration must not unhide this window's File menu
			assert.isTrue(pluginWindow.document.getElementById("menu-file").hidden);
		});
	});
});
