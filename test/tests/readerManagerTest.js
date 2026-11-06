describe("Zotero.ReaderManager", function () {
	var plugin = usePluginSandbox();
	var other = usePluginSandbox({ id: "other-reader-plugin@zotero.org" });
	var log = createCallbackLog();
	var win, readerBrowser, tmpDir;

	before(async function () {
		win = await loadZoteroPane();
		tmpDir = await getTempDirectory();
		await IOUtils.writeUTF8(PathUtils.join(tmpDir, "icon.svg"), "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>");

		// The reader's event.doc is a content document, so mimic it with a non-remote type=content browser
		// (an about:blank iframe would inherit the system principal)
		readerBrowser = win.document.createXULElement("browser");
		readerBrowser.setAttribute("type", "content");
		win.document.documentElement.appendChild(readerBrowser);
		// A fresh browser starts on a system-principal about:blank, so move it to a data: document
		readerBrowser.loadURI(
			Services.io.newURI("data:text/html,<!DOCTYPE html><title>reader</title>"),
			{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }
		);
		await waitForCallback(() => readerBrowser.contentDocument?.nodePrincipal
			&& !readerBrowser.contentDocument.nodePrincipal.isSystemPrincipal, 10, 2);
	});

	after(function () {
		readerBrowser.remove();
		win.close();
	});

	beforeEach(function () {
		log.reset();
		// The plugin's pages and icons live in tmpDir
		plugin.load(["default", "reader"], { resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		for (let id of [plugin.id, other.id]) {
			await Zotero.ReaderManager._sectionManager._unregisterByPluginID(id);
			await Zotero.ReaderManager._contextMenuManager._unregisterByPluginID(id);
		}
	});

	// What a reader does on an event: Zotero calls the registered hooks and appends what they return
	function dispatchReaderEvent(type, { params = {}, reader = { itemID: 1, tabID: "tab-1", type: "pdf" } } = {}) {
		let appended = [];
		Zotero.Reader._dispatchEvent({
			type,
			reader,
			// Re-read each call, so a navigation can't leave it stale
			doc: readerBrowser.contentDocument,
			params,
			append: (...args) => appended.push(...args),
		});
		return appended;
	}

	function registerSection(options = {}) {
		return plugin.run(options => Zotero.ReaderManager.registerSection({
			sectionID: "sec",
			target: "textSelectionPopup",
			src: "popup.html",
			...options,
		}), options);
	}

	function registerMenuItem(options = {}) {
		return plugin.run(options => Zotero.ReaderManager.registerContextMenuItem({
			menuItemID: "item",
			target: "annotationContextMenu",
			label: "Do it",
			onCommand: () => {},
			...options,
		}), options);
	}

	it("should expose Zotero.ReaderManager but neither Zotero.Reader nor the manager's internals", function () {
		assert.deepEqual(plugin.run(() => ({
			registerSection: typeof Zotero.ReaderManager.registerSection,
			registerContextMenuItem: typeof Zotero.ReaderManager.registerContextMenuItem,
			// The raw reader event API, with direct reader DOM, is privileged-only
			reader: typeof Zotero.Reader,
			sectionManager: typeof Zotero.ReaderManager._sectionManager,
			handleEvent: typeof Zotero.ReaderManager._handleEvent,
		})), {
			registerSection: "function",
			registerContextMenuItem: "function",
			reader: "undefined",
			sectionManager: "undefined",
			handleEvent: "undefined",
		});
	});

	describe("sections", function () {
		it("should host the plugin's page in an iframe appended to the popup", function () {
			let sectionID = plugin.run(() => Zotero.ReaderManager.registerSection({
				sectionID: "sec-iframe",
				target: "textSelectionPopup",
				src: "popup.html",
				onRender: () => {},
			}));
			assert.isString(sectionID);

			let appended = dispatchReaderEvent("renderTextSelectionPopup", { params: { annotation: { text: "hi" } } });
			assert.lengthOf(appended, 1);
			// Chrome builds the iframe; the plugin gets no reader DOM at all
			let iframe = appended[0];
			assert.equal(iframe.tagName.toLowerCase(), "iframe");
			assert.include(iframe.className, "zotero-reader-custom-section");
			assert.include(iframe.className, sectionID);
			assert.equal(iframe.getAttribute("src"), Zotero.Plugins.getBaseURI(plugin.id) + "popup.html");
		});

		it("should render a section without onRender", function () {
			registerSection();
			let iframe = dispatchReaderEvent("renderTextSelectionPopup")[0];
			assert.equal(iframe.getAttribute("src"), Zotero.Plugins.getBaseURI(plugin.id) + "popup.html");
		});

		it("should require a src that resolves to a plugin .html page", function () {
			assert.isFalse(plugin.run(() => Zotero.ReaderManager.registerSection({
				sectionID: "no-src",
				target: "textSelectionPopup",
			})), "missing src");
			assert.isFalse(registerSection({ sectionID: "not-html", src: "data.json" }), "non-.html src");
			assert.isFalse(registerSection({ sectionID: "escape", src: "https://evil.example.com/x.html" }), "src outside the plugin");
		});

		it("should not render after unregister", function () {
			let sectionID = registerSection();
			assert.lengthOf(Zotero.ReaderManager._sectionManager.options.filter(o => o.pluginID === plugin.id), 1);
			assert.isTrue(plugin.run(sectionID => Zotero.ReaderManager.unregisterSection(sectionID), sectionID));
			assert.lengthOf(Zotero.ReaderManager._sectionManager.options.filter(o => o.pluginID === plugin.id), 0);
			assert.lengthOf(dispatchReaderEvent("renderTextSelectionPopup"), 0);
		});

		it("should reject an invalid section target", function () {
			assert.isFalse(registerSection({ target: "bogus" }));
		});

		it("should not render for a non-matching reader event", function () {
			registerSection();
			assert.lengthOf(dispatchReaderEvent("renderToolbar"), 0);
			assert.lengthOf(dispatchReaderEvent("renderSidebarAnnotationHeader"), 0);
		});

		it("should not let a plugin unregister another plugin's section", function () {
			let sectionID = registerSection({ sectionID: "owned" });
			other.load(["default", "reader"]);
			assert.isFalse(other.run(sectionID => Zotero.ReaderManager.unregisterSection(sectionID), sectionID));
			assert.isTrue(plugin.run(sectionID => Zotero.ReaderManager.unregisterSection(sectionID), sectionID));
		});
	});

	describe("context menu items", function () {
		it("should append a registered item and pass the context to onCommand", async function () {
			log.expect("onCommand");
			let menuItemID = plugin.run(() => Zotero.ReaderManager.registerContextMenuItem({
				menuItemID: "item-cmd",
				target: "annotationContextMenu",
				label: "Do it",
				onCommand: ({ itemID, params }) => report("onCommand", { itemID, ids: params.ids }),
			}));
			assert.isString(menuItemID);

			let appended = dispatchReaderEvent("createAnnotationContextMenu", { params: { ids: ["a", "b"] } });
			assert.lengthOf(appended, 1);
			let item = appended[0];
			assert.equal(item.label, "Do it");
			assert.isFunction(item.onCommand);
			assert.isFalse(item.disabled);
			item.onCommand();
			assert.deepEqual(await log.get("onCommand"), { itemID: 1, ids: ["a", "b"] });

			assert.isTrue(plugin.run(id => Zotero.ReaderManager.unregisterContextMenuItem(id), menuItemID));
			assert.lengthOf(dispatchReaderEvent("createAnnotationContextMenu"), 0);
		});

		it("should apply onShowing label and disabled overrides", function () {
			plugin.run(() => Zotero.ReaderManager.registerContextMenuItem({
				menuItemID: "item-showing",
				target: "annotationContextMenu",
				label: "Static",
				onCommand: () => {},
				onShowing: ({ params }) => ({ label: "Dynamic " + params.ids.length, disabled: true }),
			}));
			let appended = dispatchReaderEvent("createAnnotationContextMenu", { params: { ids: ["x"] } });
			assert.equal(appended[0].label, "Dynamic 1");
			assert.isTrue(appended[0].disabled);
		});

		it("should omit an item whose onShowing returns false", function () {
			plugin.run(() => Zotero.ReaderManager.registerContextMenuItem({
				menuItemID: "item-hidden",
				target: "annotationContextMenu",
				label: "Hidden",
				onCommand: () => {},
				onShowing: () => false,
			}));
			assert.lengthOf(dispatchReaderEvent("createAnnotationContextMenu"), 0);
		});

		it("should group items from the same event into one append call", function () {
			registerMenuItem({ menuItemID: "grp-a", target: "colorContextMenu", label: "A" });
			registerMenuItem({ menuItemID: "grp-b", target: "colorContextMenu", label: "B" });
			assert.lengthOf(dispatchReaderEvent("createColorContextMenu"), 2);
		});

		it("should route items only to their own menu target", function () {
			registerMenuItem({ menuItemID: "route-thumb", target: "thumbnailContextMenu", label: "T" });
			assert.lengthOf(dispatchReaderEvent("createSelectorContextMenu"), 0);
			assert.lengthOf(dispatchReaderEvent("createThumbnailContextMenu"), 1);
		});

		it("should reject invalid targets and missing required fields", function () {
			assert.isFalse(registerMenuItem({ menuItemID: "bad-target", target: "bogus" }));
			assert.isFalse(plugin.run(() => Zotero.ReaderManager.registerContextMenuItem({
				menuItemID: "no-label", target: "colorContextMenu", onCommand: () => {},
			})), "no label");
			assert.isFalse(plugin.run(() => Zotero.ReaderManager.registerContextMenuItem({
				menuItemID: "no-command", target: "colorContextMenu", label: "x",
			})), "no onCommand");
		});

		it("should reject icons from outside the plugin and Zotero", function () {
			assert.isFalse(registerMenuItem({ icon: "javascript:alert(1)" }), "javascript: is unsafe from any origin");
			assert.isFalse(registerMenuItem({ icon: "https://evil.example.com/i.svg" }), "an undeclared remote origin");
			assert.isString(registerMenuItem({ icon: WebExtensionPolicy.getByID(plugin.id).getURL("icon.svg") }),
				"the plugin's own resource");
		});
	});
});
