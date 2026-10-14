describe("Zotero.ItemPaneManager", function () {
	var plugin = usePluginSandbox();
	var log = createCallbackLog();
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var win, ZoteroPane, infoSection;

	before(async function () {
		win = await loadZoteroPane();
		ZoteroPane = win.ZoteroPane;
		infoSection = ZoteroPane.itemPane._itemDetails.getPane("info");
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		log.reset();
		plugin.load(["default", "dataRead", "itemPane"]);
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		win.Zotero_Tabs.select("zotero-pane");
		win.Zotero_Tabs.closeAll();
		await Zotero.ItemPaneManager._infoRowManager._unregisterByPluginID(plugin.id);
		await Zotero.ItemPaneManager._sectionManager._unregisterByPluginID(plugin.id);
	});

	describe("info rows", function () {
		// A row showing its item's ID; resolves once the pane has asked for its value
		async function registerRow(options = {}) {
			log.expect("onGetData");
			let rowID = plugin.run(options => Zotero.ItemPaneManager.registerInfoRow({
				rowID: "default-test",
				label: { l10nID: "general-print" },
				onGetData: ({ itemID }) => {
					report("onGetData", String(itemID));
					return String(itemID);
				},
				...options,
			}), options);
			await log.get("onGetData");
			return rowID;
		}

		async function unregisterRow(rowID) {
			let refreshed = waitForNotifierEvent("refresh", "infobox");
			assert.isTrue(plugin.run(rowID => Zotero.ItemPaneManager.unregisterInfoRow(rowID), rowID));
			await refreshed;
		}

		function rowValue(rowID) {
			return infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"] .value`);
		}

		async function selectNewItem(itemType = "book") {
			let item = await createDataObject("item", { itemType });
			await ZoteroPane.selectItem(item.id);
			return item;
		}

		it("should render a row with the value onGetData returns", async function () {
			let item = await selectNewItem();
			let rowID = await registerRow();
			assert.equal(rowValue(rowID).value, String(item.id));
		});

		it("should pass an edited value to onSetData", async function () {
			await selectNewItem();
			log.expect("onGetData");
			let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
				rowID: "default-test",
				label: { l10nID: "general-print" },
				onGetData: ({ itemID }) => {
					report("onGetData");
					return String(itemID);
				},
				onSetData: ({ value }) => report("onSetData", value),
			}));
			await log.get("onGetData");

			log.expect("onSetData");
			let valueElem = rowValue(rowID);
			valueElem.focus();
			valueElem.value = "TEST CUSTOM ROW";
			valueElem.dispatchEvent(new Event("blur"));
			assert.equal(await log.get("onSetData"), "TEST CUSTOM ROW");
		});

		it("should let onItemChange enable the row and make it editable", async function () {
			await selectNewItem("book");
			log.expect("onItemChange");
			let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
				rowID: "default-test",
				label: { l10nID: "general-print" },
				onGetData: ({ itemID }) => String(itemID),
				onItemChange: ({ getItem, tabType, setEnabled, setEditable }) => {
					// A synchronous hook reads its item through getItem, with dataRead
					let editable = getItem().data.itemType === "book";
					let enabled = tabType === "library";
					setEnabled(enabled);
					setEditable(editable);
					report("onItemChange", { editable, enabled });
				},
			}));
			let result = await log.get("onItemChange");
			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			assert.isTrue(result.editable);
			assert.isFalse(rowValue(rowID).readOnly);
			assert.isTrue(result.enabled);
			assert.isFalse(rowElem.hidden);

			log.expect("onItemChange");
			let docItem = await selectNewItem("document");
			result = await log.get("onItemChange");
			assert.isFalse(result.editable);
			assert.isTrue(rowValue(rowID).readOnly);
			assert.isTrue(result.enabled);
			assert.isFalse(rowElem.hidden);

			// Not enabled outside the library tab
			let file = getTestDataDirectory();
			file.append("test.pdf");
			let attachment = await Zotero.Attachments.importFromFile({ file, parentItemID: docItem.id });
			log.expect("onItemChange");
			await ZoteroPane.viewItems([attachment]);
			let tabID = win.Zotero_Tabs.selectedID;
			await Zotero.Reader.getByTabID(tabID)._initPromise;
			win.ZoteroContextPane.collapsed = false;
			result = await log.get("onItemChange");
			let itemDetails = win.ZoteroContextPane.context._getItemContext(tabID);
			rowElem = itemDetails.getPane("info").querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			assert.isFalse(result.enabled);
			assert.isTrue(rowElem.hidden);
		});

		it("should render the row at its position", async function () {
			await selectNewItem();
			let rowElem = rowID => infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);

			let rowID = await registerRow({ position: "start" });
			assert.notExists(rowElem(rowID).previousElementSibling);
			await unregisterRow(rowID);

			rowID = await registerRow({ position: "afterCreators" });
			assert.exists(rowElem(rowID).previousElementSibling.querySelector(".creator-type-value"));
			assert.notExists(rowElem(rowID).nextElementSibling.querySelector(".creator-type-value"));
			await unregisterRow(rowID);

			rowID = await registerRow({ position: "end" });
			assert.exists(rowElem(rowID).nextElementSibling.querySelector("*[fieldname=dateAdded]"));
		});

		for (let [option, property, byDefault] of [
			["editable", "readOnly", false],
			["multiline", "multiline", false],
			["nowrap", "noWrap", false],
		]) {
			it(`should set the input's ${property} from ${option}`, async function () {
				await selectNewItem();
				let expected = { readOnly: value => !value }[property] || (value => value);
				for (let value of [undefined, true, false]) {
					let rowID = await registerRow(value === undefined ? {} : { [option]: value });
					assert.equal(rowValue(rowID)[property], value === undefined ? byDefault : expected(value),
						`${option}: ${value}`);
					await unregisterRow(rowID);
				}
			});
		}

		it("should render the row's current value on refreshInfoRow", async function () {
			await selectNewItem();
			let rowID = await registerRow();
			let valueElem = rowValue(rowID);
			let oldValue = valueElem.value;
			// With no onSetData the edit goes nowhere; a refresh renders what onGetData says
			valueElem.value = "TEST CUSTOM ROW EDITED";
			let refreshed = waitForNotifierEvent("refresh", "infobox");
			plugin.run(rowID => Zotero.ItemPaneManager.refreshInfoRow(rowID), rowID);
			await refreshed;
			assert.equal(valueElem.value, oldValue);
		});

		// https://github.com/zotero/zotero/issues/4874
		it("should render the row's value after the item changes", async function () {
			let item = await selectNewItem();
			let rowID = await registerRow();
			assert.equal(rowValue(rowID).value, String(item.id));

			log.expect("onGetData");
			let docItem = await selectNewItem("document");
			await log.get("onGetData");
			assert.equal(rowValue(rowID).value, String(docItem.id));
		});

		it("should answer the pane's onGetData call and stop once unregistered", async function () {
			let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
				rowID: "sandbox-row",
				label: { l10nID: "general-print" },
				onGetData: ({ itemID }) => "row-data-" + itemID,
			}));
			assert.isString(rowID);
			// The pane calls the hook as Zotero's own code
			let item = await createDataObject("item");
			let onGetData = Zotero.ItemPaneManager.getInfoRowHook(rowID, "onGetData");
			assert.equal(onGetData({ itemID: item.id, item }), "row-data-" + item.id);

			assert.isTrue(plugin.run(rowID => Zotero.ItemPaneManager.unregisterInfoRow(rowID), rowID));
			assert.isUndefined(Zotero.ItemPaneManager.getInfoRowHook(rowID, "onGetData"));
		});

		it("should contain a throwing onGetData", async function () {
			let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
				rowID: "sandbox-err-row",
				label: { l10nID: "general-print" },
				onGetData: () => {
					throw new Error("Sandbox onGetData error");
				},
			}));
			let item = await createDataObject("item");
			assert.isNull(Zotero.ItemPaneManager.getInfoRowHook(rowID, "onGetData")({ itemID: item.id, item }),
				"the base's null fallback stands in");
		});
	});

	describe("sections", function () {
		var tmpDir;

		before(async function () {
			tmpDir = await getTempDirectory();
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "section-script.js"),
				"document.getElementById('section-marker').setAttribute('data-script-ran', 'true');\n"
				// The page renders from whatever the plugin sends it through the injected messenger
				+ "zoteroHost.addMessageListener(function (data) {\n"
				+ "  if (data && 'marker' in data) {\n"
				+ "    document.getElementById('section-marker').textContent = data.marker;\n"
				+ "  }\n"
				+ "});\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "section.html"),
				"<!DOCTYPE html><html><head><title>Section</title></head><body>"
				+ "<div id='section-marker'>Embedded section body</div>"
				+ '<script src="section-script.js"></script></body></html>'
			);
		});

		// The section page has to live inside the plugin, so the plugin is rooted at tmpDir
		function loadSectionPlugin(permissions = ["default", "dataRead", "itemPane"]) {
			plugin.load(permissions, { resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
		}

		// The header and sidenav keys must not resolve to a message with a value, or Fluent would replace
		// the section's children with it
		function registerSection(options = {}) {
			return plugin.run(options => Zotero.ItemPaneManager.registerSection({
				paneID: "sandbox-embedded-section",
				header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/empty.png" },
				sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/empty.png" },
				onRender: () => {},
				src: "section.html",
				...options,
			}), options);
		}

		it("should drop bodyXHTML and require a page within the plugin as src", function () {
			loadSectionPlugin();
			assert.isFalse(plugin.run(() => Zotero.ItemPaneManager.registerSection({
				paneID: "sandbox-embedded-section",
				header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/empty.png" },
				sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/empty.png" },
				onRender: () => {},
				bodyXHTML: "<div>nope</div>",
			})), "registration without src is rejected");
			assert.isFalse(registerSection({ src: "https://example.com/section.html" }), "external src is rejected");
			assert.isFalse(registerSection({ src: "chrome://zotero/content/zoteroPane.xhtml" }), "chrome src is rejected");
			assert.isFalse(registerSection({ src: "section.xhtml" }), "non-.html src is rejected");

			let paneID = registerSection({ bodyXHTML: "<div>dropped</div>" });
			assert.isString(paneID, "a valid src registers");
			let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
			assert.isUndefined(option.bodyXHTML, "bodyXHTML is dropped");
			assert.equal(option.src, Zotero.Plugins.getBaseURI(plugin.id) + "section.html");
		});

		it("should let a privileged plugin use src too, keeping bodyXHTML", function () {
			loadSectionPlugin(["*"]);
			let register = src => plugin.run(src => Zotero.ItemPaneManager.registerSection({
				pluginID: PLUGIN_ID,
				paneID: "sandbox-embedded-section",
				header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/empty.png" },
				sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/empty.png" },
				onRender: () => {},
				src,
				bodyXHTML: "<html:div>fallback</html:div>",
			}), src);
			assert.isFalse(register("https://example.com/section.html"), "external src is rejected for privileged plugins too");

			let paneID = register("section.html");
			assert.isString(paneID);
			let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
			assert.equal(option.src, Zotero.Plugins.getBaseURI(plugin.id) + "section.html");
			assert.equal(option.bodyXHTML, "<html:div>fallback</html:div>", "bodyXHTML is kept for privileged plugins");
		});

		it("should show the section page in an embedded browser and drive it with the page messenger", async function () {
			loadSectionPlugin();
			let paneID = plugin.run(() => Zotero.ItemPaneManager.registerSection({
				paneID: "sandbox-embedded-section",
				header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/empty.png" },
				sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/empty.png" },
				src: "section.html",
				// No DOM handoff: the plugin renders its page by messaging it
				onRender: ({ page, itemID }) => page.sendMessage({ marker: "rendered-" + itemID }),
			}));
			assert.isString(paneID);

			let item = await createDataObject("item");
			await ZoteroPane.selectItem(item.id);
			let itemDetails = ZoteroPane.itemPane._itemDetails;
			let getSection = () => itemDetails.getPanes().find(elem => elem.dataset.pane === paneID);
			await waitForCallback(() => getSection(), 50, 5);
			await waitForScrollToPane(itemDetails, paneID);

			let section = getSection();
			let browser = section.querySelector("browser.plugin-section-browser");
			assert.ok(browser, "the section body holds a content browser");
			assert.isNull(section.querySelector("#section-marker"), "page markup is not inserted into the chrome document");

			let marker;
			await waitForCallback(() => {
				marker = browser.contentDocument?.getElementById("section-marker");
				return marker && marker.textContent === "rendered-" + item.id;
			}, 50, 5);
			assert.equal(marker.getAttribute("data-script-ran"), "true", "page scripts run inside the embedded page");
		});

		describe("full height", function () {
			// Register a section on the plugin's page, select an item and scroll to the section so it renders
			async function setUpSection(paneID, fullHeight) {
				loadSectionPlugin();
				let registeredID = plugin.run((paneID, fullHeight) => Zotero.ItemPaneManager.registerSection({
					paneID,
					header: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/16/universal/note.svg" },
					sidenav: { l10nID: "example-item-pane-header", icon: "chrome://zotero/skin/20/universal/note.svg" },
					src: "section.html",
					onRender: ({ setFullHeight }) => {
						if (fullHeight) {
							setFullHeight(true);
						}
					},
				}), paneID, fullHeight);

				let item = await createDataObject("item");
				await ZoteroPane.selectItem(item.id);
				// The pane ID is already CSS-escaped, which getPane() would escape again
				let itemDetails = ZoteroPane.itemPane._itemDetails;
				let getSection = () => itemDetails.getPanes().find(elem => elem.dataset.pane === registeredID);
				await waitForCallback(() => getSection(), 50, 5);
				await waitForScrollToPane(itemDetails, registeredID);
				let section = await waitForCallback(() => {
					let elem = getSection();
					let browser = elem?.querySelector("browser.plugin-section-browser");
					return browser?.contentDocument?.getElementById("section-marker") ? elem : false;
				}, 50, 5);
				// Full-height mode only applies while the section is open
				section.open = true;
				return section;
			}

			function scrollportHeight() {
				return ZoteroPane.itemPane._itemDetails._paneParent.clientHeight;
			}

			it("should fill the visible pane height when setFullHeight(true) is called", async function () {
				let section = await setUpSection("full-height-example", true);
				assert.isTrue(section.fullHeight);
				assert.isTrue(section.hasAttribute("data-full-height"));
				// At least as tall as the visible pane area, even though the stack overflows
				await waitForCallback(() => section.getBoundingClientRect().height >= scrollportHeight() - 2, 50, 5);
			});

			it("should keep content height when full height is not enabled", async function () {
				let section = await setUpSection("non-full-height-example", false);
				assert.isFalse(section.fullHeight);
				assert.isFalse(section.hasAttribute("data-full-height"));
				assert.isBelow(section.getBoundingClientRect().height, scrollportHeight() / 2);
			});

			it("should toggle full height at runtime", async function () {
				let section = await setUpSection("toggle-full-height-example", true);
				await waitForCallback(() => section.getBoundingClientRect().height >= scrollportHeight() - 2, 50, 5);
				section.fullHeight = false;
				assert.isFalse(section.hasAttribute("data-full-height"));
				await waitForCallback(() => section.getBoundingClientRect().height < scrollportHeight() / 2, 50, 10);
			});

			it("should drop to header height while the section is collapsed", async function () {
				let section = await setUpSection("collapsed-full-height-example", true);
				section.open = false;
				assert.isTrue(section.hasAttribute("data-full-height"));
				await waitForCallback(() => section.getBoundingClientRect().height < scrollportHeight() / 2, 50, 10);
			});
		});

		describe("resize", function () {
			before(async function () {
				// The page sizes its section through zoteroHost.api.resize and records each outcome
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "resize-page.js"),
					"var results = document.getElementById('results');\n"
					+ "function record(name, promise) {\n"
					+ "  return promise.then(\n"
					+ "    function (applied) { results.dataset[name] = JSON.stringify(applied); },\n"
					+ "    function (e) { results.dataset[name] = 'error: ' + e.message; }\n"
					+ "  );\n"
					+ "}\n"
					+ "record('width', zoteroHost.api.resize({ width: 100 }))\n"
					+ "  .then(function () { return record('bad', zoteroHost.api.resize({ height: '240' })); })\n"
					+ "  .then(function () { return record('huge', zoteroHost.api.resize({ height: 1e6 })); })\n"
					+ "  .then(function () { return record('height', zoteroHost.api.resize({ height: 240 })); });\n"
				);
				await FileIO.writeUTF8(
					PathUtils.join(tmpDir, "resize-page.html"),
					"<!DOCTYPE html><html><head><title>Resize</title></head>"
					+ "<body><div id='results'></div><script src='resize-page.js'></script></body></html>"
				);
			});

			it("should size the section as the page asks, on the height only and within a few screens", async function () {
				loadSectionPlugin();
				let paneID = registerSection({ paneID: "resize-example", src: "resize-page.html" });
				let item = await createDataObject("item");
				await ZoteroPane.selectItem(item.id);
				let itemDetails = ZoteroPane.itemPane._itemDetails;
				let getSection = () => itemDetails.getPanes().find(elem => elem.dataset.pane === paneID);
				await waitForCallback(() => getSection(), 50, 5);
				await waitForScrollToPane(itemDetails, paneID);
				let getBrowser = () => getSection()?.querySelector("browser.plugin-section-browser");
				// The page's last call is the one that sets the height
				let results = await waitForCallback(() => {
					let elem = getBrowser()?.contentDocument?.getElementById("results");
					return elem?.dataset.height ? elem : false;
				}, 50, 5);
				assert.equal(getBrowser().getBoundingClientRect().height, 240);
				assert.deepEqual(JSON.parse(results.dataset.height), { height: 240 });
				assert.equal(results.dataset.width, "error: resize: The width can't be set here");
				assert.equal(results.dataset.bad, "error: resize: Param 'height' must be a non-negative number");
				assert.deepEqual(JSON.parse(results.dataset.huge), { height: win.screen.availHeight * 4 });
			});
		});
	});

	it("should reserve every built-in pane ID from custom sections", function () {
		assert.sameMembers(
			Zotero.ItemPaneManager._sectionManager._builtInPaneIDs,
			ZoteroPane.itemPane._itemDetails.sidenav._builtInPanes
		);
	});
});
