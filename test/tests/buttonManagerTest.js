describe("Zotero.ButtonManager", function () {
	var plugin = usePluginSandbox();
	var log = createCallbackLog();
	var win, doc, ZoteroPane, Zotero_Tabs;

	const ICON = "chrome://zotero/skin/16/universal/plus.svg";

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		Zotero_Tabs.select("zotero-pane");
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		log.reset();
		plugin.load(["default", "button"]);
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		Zotero_Tabs.select("zotero-pane");
		await Zotero.ButtonManager._buttonManager._unregisterByPluginID(plugin.id);
	});

	// A click button reporting its context; resolves once the toolbars have refreshed
	async function registerButton(options = {}) {
		let refreshed = waitForNotifierEvent("refresh", "custom-button");
		let buttonID = plugin.run((icon, options) => Zotero.ButtonManager.registerButton({
			buttonID: "default-test",
			target: "main/library/toolbar",
			l10nID: "menu-print",
			icon,
			onCommand: context => report("onCommand", context),
			...options,
		}), ICON, options);
		assert.isString(buttonID);
		await refreshed;
		return buttonID;
	}

	async function unregisterButton(buttonID) {
		let refreshed = waitForNotifierEvent("refresh", "custom-button");
		assert.isTrue(plugin.run(buttonID => Zotero.ButtonManager.unregisterButton(buttonID), buttonID));
		await refreshed;
	}

	function toolbarButtons() {
		return doc.querySelector("#zotero-tb-custom-buttons");
	}

	function buttonIn(elem, buttonID) {
		return elem.querySelector(`.zotero-custom-button.${CSS.escape(buttonID)}`);
	}

	// Run with a window wide enough for every button, restoring its width after
	async function withWideWindow(fn) {
		let originalWidth = win.outerWidth;
		if (originalWidth < 1200) {
			win.resizeTo(1200, win.outerHeight);
			await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
		}
		try {
			await fn();
		}
		finally {
			if (originalWidth < 1200) {
				win.resizeTo(originalWidth, win.outerHeight);
			}
		}
	}

	function pressKey(target, key) {
		target.focus();
		target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
	}

	it("should reject invalid options", function () {
		let register = (options, withCommand = true) => plugin.run((icon, options, withCommand) => {
			let button = { buttonID: "invalid-test", target: "main/library/toolbar", l10nID: "menu-print", icon, ...options };
			if (withCommand) {
				button.onCommand = () => {};
			}
			return Zotero.ButtonManager.registerButton(button);
		}, ICON, options, withCommand);
		assert.isFalse(register({}, false), "neither onCommand nor menus");
		assert.isFalse(register({ menus: [{ menuType: "menuitem", l10nID: "menu-print" }] }), "both onCommand and menus");
		assert.isFalse(register({ menus: [] }, false), "empty menus");
		assert.isFalse(register({ target: "main/unknown" }), "an invalid target");
	});

	it("should render a click button in the items toolbar", async function () {
		log.expect("onCommand");
		let buttonID = await registerButton();
		let button = buttonIn(toolbarButtons(), buttonID);
		assert.exists(button);
		assert.isFalse(button.hidden);

		button.dispatchEvent(new MouseEvent("command", { bubbles: true }));
		// An unprivileged onCommand gets the context alone, the selection as IDs
		let context = await log.get("onCommand");
		assert.equal(context.tabType, "library");
		assert.equal(context.tabID, "zotero-pane");
		assert.isArray(context.itemIDs);

		await unregisterButton(buttonID);
		assert.notExists(toolbarButtons().querySelector(`.${CSS.escape(buttonID)}`));
	});

	it("should render a dropdown button and populate its menu", async function () {
		log.expect("onCommand");
		let refreshed = waitForNotifierEvent("refresh", "custom-button");
		let buttonID = plugin.run(icon => Zotero.ButtonManager.registerButton({
			buttonID: "dropdown-test",
			target: "main/library/toolbar",
			l10nID: "menu-print",
			icon,
			menus: [{
				menuType: "menuitem",
				l10nID: "menu-print",
				onCommand: context => report("onCommand", context.tabType),
			}],
		}), ICON);
		await refreshed;

		let button = buttonIn(toolbarButtons(), buttonID);
		assert.equal(button.getAttribute("type"), "menu");
		let popup = button.querySelector("menupopup");
		await simulateMenuOpen(popup);
		let menuItem = popup.querySelector(".zotero-custom-menu-item");
		assert.exists(menuItem, "the menu holds the registered item");
		menuItem.dispatchEvent(new MouseEvent("command", { bubbles: false }));
		assert.equal(await log.get("onCommand"), "library");
		await simulateMenuClosed(popup);

		// The button's own menu registration goes with it
		let menuKey = Zotero.ButtonManager.getButtonOptions("main/library/toolbar")
			.find(option => option.buttonID === buttonID)._menuKey;
		assert.exists(Zotero.MenuManager._menuManager._optionsCache[menuKey]);
		await unregisterButton(buttonID);
		assert.notExists(Zotero.MenuManager._menuManager._optionsCache[menuKey]);
	});

	it("should collapse buttons into the overflow menu when space is not enough", async function () {
		await withWideWindow(async () => {
			log.expect("onCommand");
			let menuIcon = "chrome://zotero/skin/16/universal/plus-circle.svg";
			for (let i = 0; i < 3; i++) {
				// The first button provides a dedicated overflow menu icon
				await registerButton({ buttonID: `overflow-test-${i}`, ...(i === 0 ? { menuIcon } : {}) });
			}
			let elem = toolbarButtons();
			elem._updateOverflow();
			let initialCount = elem._visibleCount;
			assert.isAbove(initialCount, 0, "some buttons are visible at first");

			// Take all free space in the toolbar; the resize observer can't see pure content overflow (in real
			// use the toolbar itself resizes), so the overflow update runs by hand
			let spacer = elem.previousElementSibling;
			let dummy = doc.createXULElement("box");
			dummy.style.minWidth = "10000px";
			dummy.style.flexShrink = "0";
			spacer.parentElement.insertBefore(dummy, spacer);
			try {
				elem._updateOverflow();
				assert.equal(elem._visibleCount, 0, "every button is collapsed");
				let overflowButton = elem.querySelector(".zotero-custom-button-overflow");
				assert.isFalse(overflowButton.hidden);

				let popup = overflowButton.querySelector("menupopup");
				await simulateMenuOpen(popup);
				let overflowItems = popup.querySelectorAll(".zotero-custom-button-overflow-item");
				assert.equal(overflowItems.length, 3);
				assert.equal(overflowItems[0].style.getPropertyValue("--custom-menu-icon-light"), `url(${menuIcon})`,
					"a dedicated menu icon is preferred");
				assert.equal(overflowItems[1].style.getPropertyValue("--custom-menu-icon-light"), `url(${ICON})`);
				overflowItems[0].dispatchEvent(new MouseEvent("command", { bubbles: false }));
				assert.equal((await log.get("onCommand")).tabType, "library");
				await simulateMenuClosed(popup);
			}
			finally {
				dummy.remove();
			}
			elem._updateOverflow();
			assert.equal(elem._visibleCount, initialCount, "the buttons expand again once space is back");
		});
	});

	it("should render buttons in the reader toolbar", async function () {
		log.expect("onCommand");
		// Registered before the reader opens
		let buttonID = await registerButton({ buttonID: "reader-test", target: "reader/toolbar" });

		let pdfAttachment = await importFileAttachment("test.pdf");
		await ZoteroPane.viewItems([pdfAttachment]);
		let tabID = Zotero_Tabs.selectedID;
		let reader = Zotero.Reader.getByTabID(tabID);
		await reader._initPromise;
		let readerDoc = () => reader._iframeWindow.document;
		let button = await waitForCallback(() => buttonIn(readerDoc(), buttonID), 50, 5);

		button.click();
		let context = await log.get("onCommand");
		assert.equal(context.tabType, "reader");
		assert.equal(context.tabSubType, "pdf");
		assert.equal(context.tabID, tabID);
		assert.deepEqual(context.itemIDs, [pdfAttachment.id]);

		let openID = await registerButton({ buttonID: "reader-test-2", target: "reader/toolbar" });
		await waitForCallback(() => buttonIn(readerDoc(), openID), 50, 5);

		let epubID = await registerButton({ buttonID: "reader-test-3", target: "reader/toolbar", enableForTabTypes: ["reader/epub"] });
		assert.notExists(buttonIn(readerDoc(), epubID), "a button for another reader type is not rendered");

		await unregisterButton(buttonID);
		await waitForCallback(() => !buttonIn(readerDoc(), buttonID), 50, 5);
		Zotero_Tabs.close(tabID);
	});

	it("should not let the search box internals overflow while collapsing", async function () {
		await withWideWindow(async () => {
			for (let i = 0; i < 3; i++) {
				await registerButton({ buttonID: `squeeze-test-${i}` });
			}
			let elem = toolbarButtons();
			let spacer = elem.previousElementSibling;
			let search = doc.getElementById("zotero-tb-search");
			let advancedButton = search.querySelector("#zotero-tb-search-advanced-button");
			// A locale where the input's intrinsic width (font-metric dependent) exceeds the search box's flex basis
			let inputField = search.searchTextbox.inputField;
			inputField.setAttribute("size", "40");
			let dummy = doc.createXULElement("box");
			dummy.style.flexShrink = "0";
			spacer.parentElement.insertBefore(dummy, spacer);
			try {
				for (let w = 0; w <= 500; w += 10) {
					dummy.style.minWidth = w + "px";
					elem._updateOverflow();
					let stickOut = advancedButton.getBoundingClientRect().right - search.getBoundingClientRect().right;
					assert.isAtMost(stickOut, 1, `the search box internals stay inside at squeeze width ${w}`);
				}
			}
			finally {
				inputField.removeAttribute("size");
				dummy.remove();
			}
		});
	});

	it("should support keyboard navigation through the toolbar buttons", async function () {
		await withWideWindow(async () => {
			for (let i = 0; i < 2; i++) {
				await registerButton({ buttonID: `keynav-test-${i}` });
			}
			let buttons = toolbarButtons().querySelectorAll(".zotero-custom-button");
			let noteAdd = doc.getElementById("zotero-tb-note-add");
			pressKey(noteAdd, Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[0]);
			pressKey(buttons[0], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[0]);
			pressKey(buttons[0], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, noteAdd);
		});
	});

	it("should compute the visible button count with hysteresis", function () {
		let compute = (budget, currentCount) => Zotero.ButtonManager._readerRenderer
			._computeVisibleCount([36, 36, 36], 40, budget, currentCount, 0);
		// Everything fits
		assert.equal(compute(108, 3), 3);
		// Two buttons and the chevron (112) don't fit either, so one button and the chevron (76) remain
		assert.equal(compute(107, 3), 1);
		// All three buttons (108) still fit
		assert.equal(compute(112, 3), 3);
		// Only the chevron fits
		assert.equal(compute(41, 3), 0);
		// No expanding without comfortable extra space
		assert.equal(compute(112, 2), 2);
		assert.equal(compute(108 + 24, 2), 3);
	});

	it("should render buttons in the title bar", async function () {
		log.expect("onCommand");
		let buttonID = await registerButton({ buttonID: "tabs-toolbar-test", target: "main/titlebar" });
		let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
		let button = buttonIn(elem, buttonID);
		assert.exists(button);
		assert.isFalse(button.hidden);
		assert.equal(elem.nextElementSibling.id, "zotero-tb-tabs-menu", "the buttons come before the tabs menu button");

		button.dispatchEvent(new MouseEvent("command", { bubbles: true }));
		let context = await log.get("onCommand");
		assert.equal(context.tabType, "library");
		assert.equal(context.tabID, "zotero-pane");
		assert.isArray(context.itemIDs);

		await unregisterButton(buttonID);
		assert.notExists(elem.querySelector(`.${CSS.escape(buttonID)}`));
	});

	it("should collapse title bar buttons when the tab bar lacks space", async function () {
		await withWideWindow(async () => {
			for (let i = 0; i < 3; i++) {
				await registerButton({ buttonID: `tabs-overflow-test-${i}`, target: "main/titlebar" });
			}
			let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
			elem._updateOverflow();
			let initialCount = elem._visibleCount;
			assert.isAbove(initialCount, 0);

			// The resize observer path is skipped while the pointer might be over the tab bar, so the overflow
			// update runs by hand
			let dummy = doc.createXULElement("box");
			dummy.style.minWidth = "10000px";
			dummy.style.flexShrink = "0";
			elem.parentElement.appendChild(dummy);
			try {
				elem._updateOverflow();
				assert.equal(elem._visibleCount, 0);
				let overflowButton = elem.querySelector(".zotero-custom-button-overflow");
				assert.isFalse(overflowButton.hidden);
				let popup = overflowButton.querySelector("menupopup");
				await simulateMenuOpen(popup);
				assert.equal(popup.querySelectorAll(".zotero-custom-button-overflow-item").length, 3);
				await simulateMenuClosed(popup);
			}
			finally {
				dummy.remove();
			}
			elem._updateOverflow();
			assert.equal(elem._visibleCount, initialCount);
		});
	});

	it("should support keyboard navigation in the title bar", async function () {
		await withWideWindow(async () => {
			for (let i = 0; i < 2; i++) {
				await registerButton({ buttonID: `tabs-keynav-test-${i}`, target: "main/titlebar" });
			}
			let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
			elem._updateOverflow();
			let buttons = elem.querySelectorAll(".zotero-custom-button");
			let tabsMenu = doc.getElementById("zotero-tb-tabs-menu");
			pressKey(buttons[0], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, tabsMenu);
			pressKey(tabsMenu, Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[0]);
		});
	});

	it("should reject icons from outside the plugin and Zotero", async function () {
		let tmpDir = await getTempDirectory();
		await IOUtils.writeUTF8(PathUtils.join(tmpDir, "icon.svg"), "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>");
		plugin.load(["default", "button"], { resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
		let register = icon => plugin.run(icon => Zotero.ButtonManager.registerButton({
			buttonID: "icon-test",
			target: "main/library/toolbar",
			l10nID: "menu-print",
			icon,
			onCommand: () => {},
		}), icon);
		assert.isFalse(register("javascript:alert(1)"), "javascript: is unsafe from any origin");
		assert.isFalse(register("https://evil.example.com/icon.svg"), "an undeclared remote origin");
		assert.isFalse(register("moz-extension://00000000-0000-0000-0000-000000000099/x.svg"), "another plugin's resource");
		assert.isString(register(WebExtensionPolicy.getByID(plugin.id).getURL("icon.svg")), "the plugin's own resource");
	});
});
