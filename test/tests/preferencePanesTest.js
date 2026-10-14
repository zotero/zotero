describe("Zotero.PreferencePanes", function () {
	var plugin = usePluginSandbox();
	var owner = usePluginSandbox({ id: "pane-owner@zotero.org" });
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

	var tmpDir;

	function loadPrefPaneTestScope() {
		plugin.load(["default", "preferencePane"], { resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
	}

	// The plugin registers a pane on its own page
	function registerTestPane(options = {}) {
		return plugin.run(options => Zotero.PreferencePanes.register({
			label: "Embedded Pane",
			image: "chrome://zotero/skin/20/universal/cog.svg",
			src: "prefs.html",
			...options,
		}), options);
	}

	before(async function () {
		tmpDir = await getTempDirectory();
		await FileIO.writeUTF8(
			PathUtils.join(tmpDir, "pane-script.js"),
			"document.getElementById('embedded-pane-marker').setAttribute('data-script-ran', 'true');\n"
			+ "zoteroHost.addMessageListener(function (data) {\n"
			+ "  if (data && data.type === 'ping') {\n"
			+ "    zoteroHost.sendMessage({ type: 'pong', value: data.value });\n"
			+ "  }\n"
			+ "});\n"
		);
		await FileIO.writeUTF8(
			PathUtils.join(tmpDir, "prefs.html"),
			"<!DOCTYPE html><html><head><title>Pane</title></head><body>"
			+ "<div id='embedded-pane-marker'>Frobnicate the widgets</div>"
			+ "<button data-search-strings-raw='Xyzzy'>Attributed</button>"
			+ "<select><option>Alpha</option><option>Kumquat marmalade</option></select>"
			+ '<script src="pane-script.js"></script></body></html>'
		);
	});

	after(async function () {
		await FileIO.remove(tmpDir, { recursive: true });
	});

	afterEach(function () {
		for (let pane of [...Zotero.PreferencePanes.pluginPanes]) {
			Zotero.PreferencePanes.unregister(pane.id);
		}
	});

	it("should register an unprivileged plugin pane as embedded and drop privileged options", async function () {
		loadPrefPaneTestScope();
		let paneID = await plugin.run(() => Zotero.PreferencePanes.register({
			label: "Embedded Pane",
			image: "chrome://zotero/skin/20/universal/cog.svg",
			src: "prefs.html",
			scripts: ["pane-script.js"],
			stylesheets: ["style.css"],
			l10nFiles: ["pane.ftl"],
			onLoad: () => {},
		}));
		let pane = Zotero.PreferencePanes.pluginPanes.find(p => p.id == paneID);
		assert.isTrue(pane.embedded, "pane should be embedded");
		assert.equal(pane.src, Zotero.Plugins.getBaseURI(plugin.id) + "prefs.html");
		assert.lengthOf(pane.scripts, 0, "scripts should be dropped");
		assert.lengthOf(pane.stylesheets, 0, "stylesheets should be dropped");
		assert.lengthOf(pane.l10nResourceIDs, 0, "l10nFiles should be dropped");
		assert.isFunction(pane.onLoad, "onLoad should be kept (wrapped for the sandbox)");
	});

	it("should register under the caller's own pluginID, not a spoofed one", async function () {
		loadPrefPaneTestScope();
		// The unprivileged plugin claims another plugin's ID; the framework must inject its real one
		let paneID = await registerTestPane({ pluginID: "other-plugin@zotero.org", label: "x" });
		let pane = Zotero.PreferencePanes.pluginPanes.find(p => p.id == paneID);
		assert.equal(pane.pluginID, plugin.id, "pane is owned by the real caller, not the spoofed ID");
		assert.isTrue(pane.embedded, "and is still treated as unprivileged");
	});

	it("should refuse unregistering a pane owned by another plugin", async function () {
		// A privileged plugin owns the pane; it gets the raw API, so it names itself
		owner.load(["*"]);
		let ownerPane = await owner.run(src => Zotero.PreferencePanes.register({
			pluginID: PLUGIN_ID,
			label: "owned",
			image: "chrome://zotero/skin/20/universal/cog.svg",
			src,
		}), PathUtils.toFileURI(PathUtils.join(tmpDir, "prefs.html")));

		loadPrefPaneTestScope();
		plugin.run(paneID => Zotero.PreferencePanes.unregister(paneID), ownerPane);
		assert.isTrue(Zotero.PreferencePanes.pluginPanes.some(p => p.id === ownerPane), "the other plugin's unregister is refused");
		owner.run(paneID => Zotero.PreferencePanes.unregister(paneID, PLUGIN_ID), ownerPane);
		assert.isFalse(Zotero.PreferencePanes.pluginPanes.some(p => p.id === ownerPane), "the owner can still unregister it");
	});

	it("should reject src outside the plugin or non-HTML src for an unprivileged plugin", async function () {
		loadPrefPaneTestScope();
		let e = await getPromiseError(registerTestPane({ src: "https://example.com/prefs.html" }));
		assert.ok(e, "external src should be rejected");
		e = await getPromiseError(registerTestPane({
			src: "chrome://zotero/content/preferences/preferences_general.xhtml",
		}));
		assert.ok(e, "chrome src should be rejected");
		e = await getPromiseError(registerTestPane({ src: "prefs.xhtml" }));
		assert.ok(e, "non-.html src should be rejected");
	});

	it("should show the pane page in an embedded browser without inserting it into the document", async function () {
		loadPrefPaneTestScope();
		let paneID = await registerTestPane();
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			let container = win.document.querySelector(".pane-container.embedded");
			assert.ok(container, "embedded pane container should exist");
			assert.isNull(container.querySelector("#embedded-pane-marker"),
				"pane markup should not be inserted into the preferences document");
			let browser = container.querySelector("browser.plugin-pane-browser");
			assert.ok(browser, "pane should contain a content browser");
			assert.equal(browser.currentURI.specIgnoringRef, Zotero.Plugins.getBaseURI(plugin.id) + "prefs.html");
			let marker = browser.contentDocument.getElementById("embedded-pane-marker");
			assert.ok(marker, "plugin page should be loaded in the browser");
			for (let i = 0; i < 100 && !marker.getAttribute("data-script-ran"); i++) {
				await Zotero.Promise.delay(20);
			}
			assert.equal(marker.getAttribute("data-script-ran"), "true",
				"page scripts should run inside the embedded page");
		}
		finally {
			win.close();
		}
	});

	it("should block navigation away from the pane page and open web URLs externally", async function () {
		loadPrefPaneTestScope();
		let paneID = await registerTestPane();
		let stub = sinon.stub(Zotero, "launchURL");
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			let browser = win.document.querySelector(".pane-container.embedded browser");
			let src = Zotero.Plugins.getBaseURI(plugin.id) + "prefs.html";
			browser.contentWindow.location.href = "https://example.com/";
			for (let i = 0; i < 100 && !stub.called; i++) {
				await Zotero.Promise.delay(20);
			}
			assert.isTrue(stub.calledWith("https://example.com/"),
				"web URL should open in the system browser");
			assert.equal(browser.currentURI.specIgnoringRef, src, "browser should stay on the plugin page");

			// The pane is single-page -- other pages within the plugin are blocked too
			browser.contentWindow.location.href = Zotero.Plugins.getBaseURI(plugin.id) + "other.html";
			for (let i = 0; i < 15; i++) {
				await Zotero.Promise.delay(20);
			}
			assert.equal(browser.currentURI.specIgnoringRef, src,
				"browser should not navigate to other plugin pages");
			assert.isTrue(stub.calledOnce, "non-web navigation should not open the system browser");
		}
		finally {
			stub.restore();
			win.close();
		}
	});

	it("should sync the embedded browser height with the page height", async function () {
		loadPrefPaneTestScope();
		let paneID = await registerTestPane();
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			let browser = win.document.querySelector(".pane-container.embedded browser");
			let initialHeight = 0;
			for (let i = 0; i < 100; i++) {
				initialHeight = browser.getBoundingClientRect().height;
				if (initialHeight > 0) break;
				await Zotero.Promise.delay(20);
			}
			assert.isAbove(initialHeight, 0, "browser should get the page height after load");
			assert.equal(browser.contentWindow.scrollMaxY, 0,
				"page should not scroll vertically after sync");

			let filler = browser.contentDocument.createElement("div");
			filler.style.height = "2000px";
			browser.contentDocument.body.appendChild(filler);
			let grownHeight = initialHeight;
			for (let i = 0; i < 100 && grownHeight < initialHeight + 1900; i++) {
				await Zotero.Promise.delay(20);
				grownHeight = browser.getBoundingClientRect().height;
			}
			assert.isAtLeast(grownHeight, initialHeight + 1900, "browser should grow with the page");
			assert.equal(browser.contentWindow.scrollMaxY, 0,
				"page should not scroll vertically after growing");

			filler.remove();
			let shrunkHeight = grownHeight;
			for (let i = 0; i < 100 && shrunkHeight > initialHeight + 100; i++) {
				await Zotero.Promise.delay(20);
				shrunkHeight = browser.getBoundingClientRect().height;
			}
			assert.isBelow(shrunkHeight, initialHeight + 100, "browser should shrink when the page shrinks");
		}
		finally {
			win.close();
		}
	});

	it("should match and highlight embedded pane content when searching", async function () {
		loadPrefPaneTestScope();
		await registerTestPane();
		// Open on a built-in pane so the plugin pane loads during the search
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: "zotero-prefpane-general" });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			let searchField = win.document.getElementById("prefs-search");
			searchField.focus();

			// Text inside the page gets a native find highlight
			await win.Zotero_Preferences._search("frobnicate");
			let container = win.document.querySelector(".pane-container.embedded");
			let browser = container.querySelector("browser");
			assert.isFalse(container.classList.contains("hidden-by-search"),
				"pane should stay visible on an embedded text match");
			let selection = win.Zotero_Preferences._getEmbeddedSearchSelection(browser);
			assert.ok(selection, "shown pane browser should have a find selection");
			assert.isAbove(selection.rangeCount, 0,
				"embedded text match should get a native find highlight");
			assert.ok(win.document.activeElement.closest("#prefs-search"),
				"search box should keep focus while embedded panes load and highlight");

			// data-search-strings-raw matches get a tooltip inside the page
			await win.Zotero_Preferences._search("xyzzy");
			assert.isFalse(container.classList.contains("hidden-by-search"),
				"pane should stay visible on an embedded attribute match");
			assert.ok(browser.contentDocument.querySelector(".search-tooltip-parent .search-tooltip"),
				"embedded attribute match should get a tooltip in the page");
			assert.ok(win.document.activeElement.closest("#prefs-search"),
				"search box should keep focus across repeated searches");

			// Text in dropdown options can't be range-highlighted -- the
			// closest <select> gets a tooltip instead, like XUL menulists
			await win.Zotero_Preferences._search("kumquat");
			assert.isFalse(container.classList.contains("hidden-by-search"),
				"pane should stay visible on a dropdown option match");
			let tooltipParent = browser.contentDocument.querySelector(".search-tooltip-parent");
			assert.ok(tooltipParent, "option match should get a tooltip");
			assert.ok(tooltipParent.querySelector("select"),
				"the tooltip should wrap the select element");

			// No match hides the pane and cleans up highlights and tooltips
			await win.Zotero_Preferences._search("zzznomatch");
			assert.isTrue(container.classList.contains("hidden-by-search"),
				"pane should hide when nothing in it matches");
			// The hidden browser's selection is destroyed with its presentation
			assert.isNull(win.Zotero_Preferences._getEmbeddedSearchSelection(browser),
				"hidden pane browser should have no find selection");
			assert.isNull(browser.contentDocument.querySelector(".search-tooltip-parent"),
				"tooltips should be removed");

			// Searching again while the pane is hidden must skip the dead
			// selection and re-highlight once the pane is shown
			await win.Zotero_Preferences._search("frobnicate");
			assert.isFalse(container.classList.contains("hidden-by-search"),
				"pane should show again on a new match");
			selection = win.Zotero_Preferences._getEmbeddedSearchSelection(browser);
			assert.isAbove(selection?.rangeCount, 0,
				"highlights should come back after the pane was hidden");
		}
		finally {
			win.close();
		}
	});

	it("should call onLoad with the pane page's messenger", async function () {
		loadPrefPaneTestScope();
		let loadedPromise = new Promise(resolve => plugin.expose("reportLoaded", resolve));
		let pongPromise = new Promise(resolve => plugin.expose("reportPong", resolve));
		await plugin.run(() => Zotero.PreferencePanes.register({
			id: "test-embedded-onload",
			label: "Hooked Pane",
			image: "chrome://zotero/skin/20/universal/cog.svg",
			src: "prefs.html",
			onLoad: ({ paneID, page }) => {
				page.addMessageListener((data) => {
					if (data && data.type == "pong") {
						reportPong(data.value);
					}
				});
				page.sendMessage({ type: "ping", value: 5 });
				reportLoaded(paneID + ":" + page.isAlive());
			},
		}));
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: "test-embedded-onload" });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			assert.equal(await loadedPromise, "test-embedded-onload:true",
				"onLoad should receive the pane ID and a live page messenger");
			assert.equal(await pongPromise, 5, "the pane page should echo over zoteroHost");
		}
		finally {
			win.close();
		}
	});

	it("should let the pane page navigate via the zoteroHost.api host API", async function () {
		loadPrefPaneTestScope();
		let paneID = await registerTestPane({ id: "test-embedded-main" });
		let subpaneID = await registerTestPane({ id: "test-embedded-subpane", parent: "test-embedded-main" });
		let win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", { pane: paneID });
		try {
			await win.Zotero_Preferences.waitForFirstPaneLoad();
			let browser = win.document.querySelector(".pane-container.embedded browser");
			// Drive the injected host API here the way the pane page would
			let cwin = browser.contentWindow;
			for (let i = 0; i < 100 && !cwin.wrappedJSObject.zoteroHost; i++) {
				await Zotero.Promise.delay(20);
			}
			assert.ok(cwin.wrappedJSObject.zoteroHost, "pane page should get the injected zoteroHost messenger");
			let navigate = id => cwin.wrappedJSObject.zoteroHost.api.navigate(
				Cu.cloneInto({ paneID: id }, cwin)
			);

			// A pane from another plugin rejects and doesn't navigate
			let error = await new Promise(resolve => navigate("zotero-prefpane-general")
				.then(() => resolve(null), e => resolve(e)));
			assert.ok(error, "cross-plugin navigation should reject");
			assert.equal(win.Zotero_Preferences.navigation.value, paneID,
				"should not navigate to another plugin's pane");

			// The plugin's own subpane navigates
			navigate(subpaneID);
			// The subpane loads asynchronously after the select
			let backButton = win.document.getElementById("prefs-subpane-back-button");
			let containers = [];
			for (let i = 0; i < 100; i++) {
				containers = win.document.querySelectorAll(".pane-container.embedded");
				if (containers.length >= 2 && !backButton.hidden) {
					break;
				}
				await Zotero.Promise.delay(20);
			}
			assert.equal(win.Zotero_Preferences.navigation.value, subpaneID);
			assert.lengthOf(containers, 2, "subpane should load its own embedded browser");
			assert.isFalse(backButton.hidden, "back button should show for the subpane");
		}
		finally {
			win.close();
		}
	});
});
