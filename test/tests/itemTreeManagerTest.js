describe("Zotero.ItemTreeManager", function () {
	var plugin = usePluginSandbox();
	var log = createCallbackLog();
	var win, doc, ZoteroPane, itemsView;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		itemsView = ZoteroPane.itemsView;
	});

	after(function () {
		win.close();
	});

	beforeEach(function () {
		log.reset();
		plugin.load(["default", "itemTree"]);
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		await Zotero.ItemTreeManager._columnManager._unregisterByPluginID(plugin.id);
	});

	// Show the column in the main tree and wait for its header
	async function showColumn(dataKey) {
		itemsView._columnPrefs[dataKey] = { dataKey, hidden: false };
		let columns = itemsView._getColumns();
		let index = columns.findIndex(column => column.dataKey === dataKey);
		if (index === -1 || !columns[index].hidden) {
			return;
		}
		itemsView.tree._columns.toggleHidden(index);
		await waitForCallback(
			() => !!doc.querySelector(`#zotero-items-tree .virtualized-table-header .cell.${CSS.escape(dataKey)}`),
			100, 3);
	}

	function selectedCell(dataKey) {
		return doc.querySelector(`#zotero-items-tree .row.selected .${CSS.escape(dataKey)}`);
	}

	it("should register a column whose dataProvider answers for an item", async function () {
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "sandbox-col",
			label: "Sandbox Column",
			dataProvider: ({ itemID }) => "sandbox-data-" + itemID,
		}));
		assert.isString(dataKey);
		let column = Zotero.ItemTreeManager.getCustomColumns().find(c => c.dataKey === dataKey);
		assert.equal(column.label, "Sandbox Column");

		let item = await createDataObject("item");
		assert.equal(Zotero.ItemTreeManager.getCustomCellData(item, dataKey), "sandbox-data-" + item.id);

		assert.isTrue(plugin.run(key => Zotero.ItemTreeManager.unregisterColumn(key), dataKey));
		assert.notExists(Zotero.ItemTreeManager.getCustomColumns().find(c => c.dataKey === dataKey));
	});

	it("should render the dataProvider value in the item tree", async function () {
		let item = await createDataObject("item");
		await ZoteroPane.selectItem(item.id);
		log.expect("dataProvider");
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "api-test",
			label: "APITest",
			dataProvider: ({ itemID }) => {
				report("dataProvider");
				return String(itemID);
			},
		}));
		await log.get("dataProvider");
		await showColumn(dataKey);
		assert.equal(selectedCell(dataKey).textContent, String(item.id));
	});

	it("should let a privileged plugin build the cell in renderCell", async function () {
		plugin.load(["*"]);
		plugin.expose("report", log.report);
		let item = await createDataObject("item");
		await ZoteroPane.selectItem(item.id);
		log.expect("dataProvider");
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			// A privileged plugin gets no injected ID
			pluginID: PLUGIN_ID,
			dataKey: "api-test-render",
			label: "APITest",
			dataProvider: (_item, _dataKey, { itemID }) => {
				report("dataProvider");
				return String(itemID);
			},
			renderCell: (index, data, column, isFirstColumn, doc) => {
				let cell = doc.createElement("span");
				cell.className = `cell ${column.className}`;
				cell.textContent = "Custom renderCell";
				cell.style.color = "red";
				return cell;
			},
		}));
		await log.get("dataProvider");
		await showColumn(dataKey);
		assert.equal(win.getComputedStyle(selectedCell(dataKey)).color, "rgb(255, 0, 0)");
	});

	it("should finish column refresh in an item tree with no collection selected", async function () {
		let CollectionViewItemTree = win.require("zotero/collectionViewItemTree");
		let elem = doc.createElement("div");
		doc.documentElement.append(elem);
		let view = await CollectionViewItemTree.init(elem, { id: "item-tree-manager-test" });
		try {
			let result = await Promise.race([
				Zotero.Notifier.trigger("refresh", "itemtree", [], {}).then(() => "done"),
				Zotero.Promise.delay(5000).then(() => "timeout")
			]);
			assert.equal(result, "done");
		}
		finally {
			view.unregister();
			elem.remove();
		}
	});

	it("should contain a throwing dataProvider", async function () {
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "sandbox-err-col",
			label: "Error Column",
			dataProvider: () => {
				throw new Error("Sandbox dataProvider error");
			},
		}));
		let item = await createDataObject("item");
		// The base's fallbackReturn is "", which `|| null` turns into null
		assert.isNull(Zotero.ItemTreeManager.getCustomCellData(item, dataKey));
	});

	it("should keep the tree rendering when the hooks throw", async function () {
		let item = await createDataObject("item");
		await ZoteroPane.selectItem(item.id);
		log.expect("dataProvider");
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "api-test-throws",
			label: "APITest",
			dataProvider: () => {
				report("dataProvider");
				throw new Error("Test error");
			},
			renderCell: () => {
				throw new Error("Test error");
			},
		}));
		await log.get("dataProvider");
		await showColumn(dataKey);
		assert.exists(selectedCell(dataKey));
	});

	it("should reject a duplicate dataKey", function () {
		let register = label => plugin.run(label => Zotero.ItemTreeManager.registerColumn({
			dataKey: "sandbox-dup-col",
			label,
			dataProvider: () => "",
		}), label);
		assert.isString(register("First Column"));
		assert.isFalse(register("Duplicate Column"));
	});

	it("should render renderCell SVG URLs as an image", function () {
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "sandbox-render-col",
			label: "Render Column",
			dataProvider: () => "test",
			renderCell: (index, data) => {
				switch (index) {
					// Raw markup is not accepted, to test the fallback
					case 1: return '<svg xmlns="http://www.w3.org/2000/svg"/>';
					// A plugin-internal .svg URL
					case 2: return "cell.svg";
					// An external .svg URL, which must be rejected
					case 3: return "https://example.com/x.svg";
					// A data: URL of a non-SVG type, which must be rejected
					case 4: return "data:text/html,<script>bad()</script>";
					default: return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12">'
						+ '<text x="0" y="10">' + data + "</text></svg>");
				}
			},
		}));
		// The tree calls renderCell as Zotero's own code
		let option = Zotero.ItemTreeManager._columnManager._optionsCache[dataKey];
		let render = index => option.renderCell(index, "test", { className: "test-col" }, false, doc);

		let cell = render(0);
		assert.equal(cell.localName, "span");
		assert.equal(cell.className, "cell test-col", "the cell element itself is chrome-built");
		let img = cell.firstElementChild;
		assert.equal(img.localName, "img", "an SVG data URL is shown as an image");
		assert.match(img.src, /^data:image\/svg\+xml/);
		assert.include(decodeURIComponent(img.src), "test");
		assert.equal(img.alt, "test");

		let fallback = render(1);
		assert.equal(fallback.className, "cell test-col");
		assert.equal(fallback.textContent, "test", "raw markup falls back to the cell data");
		assert.equal(fallback.childElementCount, 0, "raw markup never becomes an image");

		assert.equal(render(2).firstElementChild.src, Zotero.Plugins.getBaseURI(plugin.id) + "cell.svg",
			"a plugin .svg URL resolves against the plugin root");

		let external = render(3);
		assert.equal(external.childElementCount, 0, "an external URL is rejected");
		assert.equal(external.textContent, "test");

		assert.equal(render(4).childElementCount, 0, "a non-SVG data: URL is rejected");
	});

	it("should restrict htmlLabel to SVG URLs", function () {
		let register = (dataKey, htmlLabel) => {
			let key = plugin.run((dataKey, htmlLabel) => Zotero.ItemTreeManager.registerColumn({
				dataKey,
				label: "Label Column",
				htmlLabel,
				dataProvider: () => "",
			}), dataKey, htmlLabel);
			assert.isString(key);
			return Zotero.ItemTreeManager._columnManager._optionsCache[key];
		};

		assert.isUndefined(register("sandbox-strlabel-col", '<b onclick="alert(1)">evil</b>').htmlLabel,
			"an HTML label is dropped");

		let svgLabel = register("sandbox-svglabel-col", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="12"><text x="0" y="10">fancy</text></svg>'
		)).htmlLabel;
		assert.match(svgLabel.svgSrc, /^data:image\/svg\+xml/, "an SVG data URL label is kept");
		assert.include(decodeURIComponent(svgLabel.svgSrc), "fancy");

		assert.equal(register("sandbox-urllabel-col", "label.svg").htmlLabel.svgSrc,
			Zotero.Plugins.getBaseURI(plugin.id) + "label.svg",
			"a plugin .svg URL label resolves against the plugin root");
	});

	it("should resolve iconPath relative to the plugin root", function () {
		let register = iconPath => plugin.run(iconPath => Zotero.ItemTreeManager.registerColumn({
			dataKey: "sandbox-icon-col",
			label: "Icon Column",
			iconPath,
			dataProvider: () => "",
		}), iconPath);
		assert.isFalse(register("https://evil.example.com/x.svg"), "an undeclared remote origin");

		let key = register("icons/column.svg");
		assert.isString(key);
		assert.equal(Zotero.ItemTreeManager._columnManager._optionsCache[key].iconPath,
			Zotero.Plugins.getBaseURI(plugin.id) + "icons/column.svg");
	});

	it("should warn about a deprecated option only when it is given", function () {
		let warn = sinon.spy(Zotero.ItemTreeManager._columnManager, "_log");
		try {
			plugin.run(() => Zotero.ItemTreeManager.registerColumn({
				dataKey: "api-test-current",
				label: "Deprecation Test",
				dataProvider: () => "",
			}));
			assert.isFalse(warn.calledWithMatch(/deprecated/), "no warning for options left out");
			plugin.run(() => Zotero.ItemTreeManager.registerColumn({
				dataKey: "api-test-legacy",
				label: "Deprecation Test",
				defaultIn: ["main"],
				dataProvider: () => "",
			}));
			assert.isTrue(warn.calledWithMatch(/'defaultIn' property is deprecated/));
		}
		finally {
			warn.restore();
		}
	});
});
