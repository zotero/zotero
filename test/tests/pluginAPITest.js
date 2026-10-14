describe("Plugin API", function () {
	var win, doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane, _itemsView, infoSection, caches;

	function resetCaches() {
		caches = {};
	}

	function initCache(key) {
		if (!caches[key]) {
			caches[key] = {};
		}
		caches[key].deferred = Zotero.Promise.defer();
		caches[key].result = "";
	}

	async function getCache(key) {
		let cache = caches[key];
		await cache.deferred.promise;
		return cache.result;
	}

	function updateCache(key, value) {
		let cache = caches[key];
		if (!cache) return;
		cache.result = value;
		cache.deferred?.resolve();
	}

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		ZoteroContextPane = win.ZoteroContextPane;
		_itemsView = win.ZoteroPane.itemsView;
		infoSection = win.ZoteroPane.itemPane._itemDetails.getPane('info');
	});

	after(function () {
		win.close();
	});
	
	describe("Item pane info box custom section", function () {
		let defaultOption = {
			rowID: "default-test",
			pluginID: "zotero@zotero.org",
			label: {
				l10nID: "general-print",
			},
			onGetData: ({ item }) => {
				let data = `${item.id}`;
				updateCache("onGetData", data);
				return data;
			},
		};

		let waitForRegister = async (option) => {
			initCache("onGetData");
			let getDataPromise = getCache("onGetData");
			let rowID = Zotero.ItemPaneManager.registerInfoRow(option);
			await getDataPromise;
			return rowID;
		};

		let waitForUnregister = async (rowID) => {
			let unregisterPromise = waitForNotifierEvent("refresh", "infobox");
			let success = Zotero.ItemPaneManager.unregisterInfoRow(rowID);
			await unregisterPromise;
			return success;
		};

		beforeEach(async function () {
			resetCaches();
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should render custom row and call onGetData hook", async function () {
			initCache("onGetData");
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let getDataPromise = getCache("onGetData");
			let rowID = Zotero.ItemPaneManager.registerInfoRow(defaultOption);
			let result = await getDataPromise;

			// Should render custom row
			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			assert.exists(rowElem);

			// Should call onGetData and render
			let valueElem = rowElem.querySelector(".value");
			assert.equal(result, valueElem.value);

			await waitForUnregister(rowID);
		});
		
		it("should call onSetData hook", async function () {
			let option = Object.assign({}, defaultOption, {
				onSetData: ({ value }) => {
					let data = `${value}`;
					updateCache("onSetData", data);
				},
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(option);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			// Should call onSetData on value change
			initCache("onSetData");
			let setDataPromise = getCache("onSetData");
			let newValue = `TEST CUSTOM ROW`;
			valueElem.focus();
			valueElem.value = newValue;
			let blurEvent = new Event("blur");
			valueElem.dispatchEvent(blurEvent);
			let result = await setDataPromise;
			assert.equal(newValue, result);

			await waitForUnregister(rowID);
		});

		it("should call onItemChange hook", async function () {
			let option = Object.assign({}, defaultOption, {
				onItemChange: ({ item, tabType, setEnabled, setEditable }) => {
					let editable = item.itemType === "book";
					let enabled = tabType === "library";
					setEnabled(enabled);
					setEditable(editable);
					let data = { editable, enabled };
					updateCache("onItemChange", data);
				}
			});

			initCache("onItemChange");

			let bookItem = new Zotero.Item('book');
			await bookItem.saveTx();
			await ZoteroPane.selectItem(bookItem.id);
			
			let itemChangePromise = getCache("onItemChange");
			let rowID = await waitForRegister(option);
			let result = await itemChangePromise;

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			// Should be enabled and editable
			assert.isTrue(result.editable);
			assert.isFalse(valueElem.readOnly);
			assert.isTrue(result.enabled);
			assert.isFalse(rowElem.hidden);

			initCache("onItemChange");
			itemChangePromise = getCache("onItemChange");
			let docItem = new Zotero.Item('document');
			await docItem.saveTx();
			await ZoteroPane.selectItem(docItem.id);
			result = await itemChangePromise;

			// Should be enabled and not editable
			assert.isFalse(result.editable);
			assert.isTrue(valueElem.readOnly);
			assert.isTrue(result.enabled);
			assert.isFalse(rowElem.hidden);

			let file = getTestDataDirectory();
			file.append('test.pdf');
			let attachment = await Zotero.Attachments.importFromFile({
				file,
				parentItemID: docItem.id
			});

			initCache("onItemChange");
			itemChangePromise = getCache("onItemChange");

			await ZoteroPane.viewItems([attachment]);
			let tabID = Zotero_Tabs.selectedID;
			let reader = Zotero.Reader.getByTabID(tabID);
			await reader._initPromise;
			// Ensure context pane is open
			ZoteroContextPane.collapsed = false;
			result = await itemChangePromise;

			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			rowElem = itemDetails.getPane("info").querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			// Should not be enabled in non-library tab
			assert.isFalse(result.enabled);
			assert.isTrue(rowElem.hidden);

			await waitForUnregister(rowID);
		});

		it("should render row at position", async function () {
			let startOption = Object.assign({}, defaultOption, {
				position: "start",
			});
			let afterCreatorsOption = Object.assign({}, defaultOption, {
				position: "afterCreators",
			});
			let endOption = Object.assign({}, defaultOption, {
				position: "end",
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);

			// Row at start
			let rowID = await waitForRegister(startOption);
			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);

			assert.notExists(rowElem.previousElementSibling);
			await waitForUnregister(rowID);

			// Row after creator rows
			rowID = await waitForRegister(afterCreatorsOption);
			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);

			assert.exists(rowElem.previousElementSibling.querySelector(".creator-type-value"));
			assert.notExists(rowElem.nextElementSibling.querySelector(".creator-type-value"));
			await waitForUnregister(rowID);

			// Row at end
			rowID = rowID = await waitForRegister(endOption);
			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);

			assert.exists(rowElem.nextElementSibling.querySelector("*[fieldname=dateAdded]"));
			await waitForUnregister(rowID);
		});

		it("should set input editable", async function () {
			let editableOption = Object.assign({}, defaultOption, {
				editable: true,
			});
			let notEditableOption = Object.assign({}, defaultOption, {
				editable: false,
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);

			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.readOnly);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(editableOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.readOnly);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(notEditableOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isTrue(valueElem.readOnly);

			await waitForUnregister(rowID);
		});

		it("should set input multiline", async function () {
			let multilineOption = Object.assign({}, defaultOption, {
				multiline: true,
			});
			let notMultilineOption = Object.assign({}, defaultOption, {
				multiline: false,
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.multiline);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(multilineOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isTrue(valueElem.multiline);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(notMultilineOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.multiline);

			await waitForUnregister(rowID);
		});

		it("should set input nowrap", async function () {
			let noWrapOption = Object.assign({}, defaultOption, {
				nowrap: true,
			});
			let wrapOption = Object.assign({}, defaultOption, {
				nowrap: false,
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.noWrap);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(noWrapOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isTrue(valueElem.noWrap);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(wrapOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.noWrap);

			await waitForUnregister(rowID);
		});

		it("should refresh custom row value", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			let oldValue = valueElem.value;

			// Since this row does not have `onSetData`, changing value does not do anything
			// We just want to test if the value can be refreshed by calling `updateInfoRow`
			let newValue = "TEST CUSTOM ROW EDITED";
			valueElem.value = newValue;

			let notifyPromise = waitForNotifierEvent("refresh", "infobox");

			// Manually refresh the row
			Zotero.ItemPaneManager.refreshInfoRow(rowID);
			await notifyPromise;

			assert.equal(oldValue, valueElem.value);

			await waitForUnregister(rowID);
		});

		it("should render custom row value after item change", async function () {
			// https://github.com/zotero/zotero/issues/4874

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${CSS.escape(rowID)}"]`);
			let valueElem = rowElem.querySelector(".value");

			let value = valueElem.value;
			assert.equal(`${item.id}`, value);

			initCache("onGetData");
			let getDataPromise = getCache("onGetData");

			let docItem = new Zotero.Item('document');
			await docItem.saveTx();
			await ZoteroPane.selectItem(docItem.id);
			await getDataPromise;

			value = valueElem.value;
			assert.equal(`${docItem.id}`, value);

			await waitForUnregister(rowID);
		});
	});

	describe("Item tree custom column", function () {
		// Only test hooks, as other column options are covered in item tree tests
		let defaultOption = {
			columnID: "default-test",
			pluginID: "zotero@zotero.org",
			dataKey: "api-test",
			label: "APITest",
			dataProvider: (item) => {
				let data = `${item.id}`;
				updateCache("dataProvider", data);
				return data;
			},
		};

		let waitForRegister = async (option) => {
			initCache("dataProvider");
			let getDataPromise = getCache("dataProvider");
			let columnKey = Zotero.ItemTreeManager.registerColumn(option);
			await getDataPromise;
			return columnKey;
		};

		let waitForColumnEnable = async (dataKey) => {
			_itemsView._columnPrefs[dataKey] = {
				dataKey,
				hidden: false,
			};
			let columns = _itemsView._getColumns();
			let columnID = columns.findIndex(column => column.dataKey === dataKey);
			if (columnID === -1) {
				return;
			}
			let column = columns[columnID];
			if (!column.hidden) {
				return;
			}
			_itemsView.tree._columns.toggleHidden(columnID);

			// Wait for column header to render
			await waitForCallback(
				() => !!doc.querySelector(`#zotero-items-tree .virtualized-table-header .cell.${CSS.escape(dataKey)}`),
				100, 3);
		};

		let waitForUnregister = async (columnID) => {
			let unregisterPromise = waitForNotifierEvent("refresh", "itemtree");
			let success = Zotero.ItemTreeManager.unregisterColumn(columnID);
			await unregisterPromise;
			return success;
		};

		let getSelectedRowCell = (dataKey) => {
			let cell = doc.querySelector(`#zotero-items-tree .row.selected .${CSS.escape(dataKey)}`);
			return cell;
		};

		beforeEach(async function () {
			resetCaches();
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should render custom column and call dataProvider hook", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let columnKey = await waitForRegister(defaultOption);

			await waitForColumnEnable(columnKey);

			// Should render custom column cell
			let cellElem = getSelectedRowCell(columnKey);

			assert.exists(cellElem);

			// Should call dataProvider and render the value
			assert.equal(`${item.id}`, cellElem.textContent);

			await waitForUnregister(columnKey);
		});

		it("should use custom renderCell hook", async function () {
			let customCellContent = "Custom renderCell";

			let option = Object.assign({}, defaultOption, {
				renderCell: (index, data, column, isFirstColumn, doc) => {
					// index: the index of the row
					// data: the data to display in the column, return of `dataProvider`
					// column: the column options
					// isFirstColumn: true if this is the first column
					// doc: the document of the item tree
					// return: the HTML to display in the cell
					const cell = doc.createElement('span');
					cell.className = `cell ${column.className}`;
					cell.textContent = customCellContent;
					cell.style.color = 'red';
					updateCache("renderCell", cell.textContent);
					return cell;
				},
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);

			let columnKey = await waitForRegister(option);

			await waitForColumnEnable(columnKey);

			// Should render custom column cell
			let cellElem = getSelectedRowCell(columnKey);

			assert.exists(cellElem);

			// Should call renderCell and render the value
			assert.equal('rgb(255, 0, 0)', win.getComputedStyle(cellElem).color);

			await waitForUnregister(columnKey);
		});

		it("should finish column refresh in an item tree with no collection selected", async function () {
			let CollectionViewItemTree = win.require('zotero/collectionViewItemTree');
			let elem = doc.createElement('div');
			doc.documentElement.append(elem);
			let itemsView = await CollectionViewItemTree.init(elem, { id: "plugin-api-test" });
			try {
				let result = await Promise.race([
					Zotero.Notifier.trigger('refresh', 'itemtree', [], {}).then(() => "done"),
					Zotero.Promise.delay(5000).then(() => "timeout")
				]);
				assert.equal(result, "done");
			}
			finally {
				itemsView.unregister();
				elem.remove();
			}
		});

		it("should not break ui when hooks throw error", async function () {
			let option = Object.assign({}, defaultOption, {
				dataProvider: () => {
					updateCache("dataProvider", "Test error");
					throw new Error("Test error");
				},
				renderCell: () => {
					updateCache("renderCell", "Test error");
					throw new Error("Test error");
				}
			});

			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let columnKey = await waitForRegister(option);

			await waitForColumnEnable(columnKey);

			// Should not break ui
			let columnElem = getSelectedRowCell(columnKey);
			assert.exists(columnElem);

			await waitForUnregister(columnKey);
		});
	});

	describe("Custom menu", function () {
		let defaultOption = {
			menuID: "default-test",
			pluginID: "zotero@zotero.org",
			menus: [{
				menuType: "menuitem",
				l10nID: "menu-print",
				onShowing: (event, context) => {
					updateCache("onShowing", context);
				},
				onCommand: (event, context) => {
					updateCache("onCommand", context);
				}
			}]
		};

		let defaultContextKeys = [
			"menuElem",
			"setEnabled",
			"setIcon",
			"setL10nArgs",
			"setVisible",
			"tabID",
			"tabType",
			"tabSubType",
		];

		// From https://searchfox.org/mozilla-esr128/source/browser/base/content/test/menubar/browser_file_close_tabs.js
		async function simulateMenuOpen(menu) {
			return new Promise((resolve) => {
				menu.addEventListener("popupshown", resolve, { once: true });
				menu.dispatchEvent(new MouseEvent("popupshowing"));
				menu.dispatchEvent(new MouseEvent("popupshown"));
			});
		}

		async function simulateMenuClosed(menu) {
			return new Promise((resolve) => {
				menu.addEventListener("popuphidden", resolve, { once: true });
				menu.dispatchEvent(new MouseEvent("popuphiding"));
				menu.dispatchEvent(new MouseEvent("popuphidden"));
			});
		}

		async function simulateMenuItemClick(menuitem) {
			return new Promise((resolve) => {
				menuitem.addEventListener("command", resolve, { once: true });
				menuitem.dispatchEvent(new MouseEvent("click"));
				menuitem.dispatchEvent(new MouseEvent("command"));
			});
		}

		async function checkMenuContext(option, popupSelector, contextKeys, targetDoc) {
			if (!targetDoc) {
				targetDoc = doc;
			}

			option = Object.assign({}, defaultOption, option);
			let target = option.target;

			initCache("onShowing");
			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);

			let popup;
			if (typeof popupSelector === "function") {
				popup = await popupSelector();
			}
			else {
				popup = targetDoc.querySelector(popupSelector);
				await simulateMenuOpen(popup);
			}
			assert.exists(popup, `Popup for target ${target} should exist`);

			let context = await getCache("onShowing");

			if (contextKeys) {
				for (let key of contextKeys) {
					assert.property(context, key, `Context of ${target} should have key: ${key}`);
				}
			}

			if (typeof popupSelector === "function") {
				popup.hidePopup();
			}
			else {
				await simulateMenuClosed(popup);
			}

			assert.isTrue(Zotero.MenuManager.unregisterMenu(menuID));
		}

		beforeEach(async function () {
			resetCaches();
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should register custom menu and call hooks", async function () {
			let option = Object.assign({}, defaultOption, {
				target: "main/menubar/file",
				menus: [{
					menuType: "menuitem",
					l10nID: "menu-print",
					onShowing: (event, context) => {
						updateCache("onShowing", context);
					},
					onShown: (event, context) => {
						updateCache("onShown", context);
					},
					onHiding: (event, context) => {
						updateCache("onHiding", context);
					},
					onHidden: (event, context) => {
						updateCache("onHidden", context);
					},
					onCommand: (event, context) => {
						updateCache("onCommand", context);
					}
				}]
			});
			initCache("onShowing");
			initCache("onShown");
			initCache("onHiding");
			initCache("onHidden");
			initCache("onCommand");
			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);

			let popup = doc.querySelector("#menu_FilePopup");
			await simulateMenuOpen(popup);
			let context = await getCache("onShowing");
			await getCache("onShown");

			assert.exists(context.menuElem);
			assert.equal(context.menuElem.parentNode, popup);

			await simulateMenuItemClick(context.menuElem);
			context = await getCache("onCommand");
			assert.exists(context);

			await simulateMenuClosed(popup);
			await Promise.all([
				getCache("onHiding"),
				getCache("onHidden")
			]);

			// Unregister the menu
			assert.isTrue(Zotero.MenuManager.unregisterMenu(menuID));

			// After unregistering and re-opening the popup, the menu should not exist
			popup.addEventListener("popupshown", () => {
				assert.notExists(popup.querySelector('.zotero-custom-menu-item'));
			}, { once: true });

			// Since the event is manually dispatched, the above listener will be triggered before the promise resolves
			await simulateMenuOpen(popup);
		});

		it("should hide custom menu when not enabled for tab type", async function () {
			let option = Object.assign({}, defaultOption, {
				target: "main/menubar/file",
				menus: [
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							context.menuElem?.classList.add("test-menu-library");
						},
						enableForTabTypes: ["library"]
					},
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							context.menuElem?.classList.add("test-menu-pdf");
						},
						enableForTabTypes: ["reader/pdf"]
					},
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							context.menuElem?.classList.add("test-menu-epub");
						},
						enableForTabTypes: ["reader/epub"]
					},
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							context.menuElem?.classList.add("test-menu-snapshot");
						},
						enableForTabTypes: ["reader/snapshot"]
					},
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							context.menuElem?.classList.add("test-menu-anyReader");
						},
						enableForTabTypes: ["reader/*"]
					}
				]
			});

			// Create items for different tab types
			let pdfItem = await importFileAttachment('test.pdf');
			let epubItem = await importFileAttachment('stub.epub');
			let snapshotItem = await importFileAttachment('test.html');

			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);
			let popup = doc.querySelector("#menu_FilePopup");

			function assertMenuVisibility(popup, visibilities) {
				for (let [className, visible] of Object.entries(visibilities)) {
					let menuItem = popup.querySelector(`.test-menu-${className}`);
					if (visible) {
						assert.isFalse(menuItem.hidden, `Menu item ${className} should be visible`);
					}
					else {
						assert.isTrue(menuItem.hidden, `Menu item ${className} should be hidden`);
					}
				}
			}

			// Open the menu in library tab
			await simulateMenuOpen(popup);
			// Should show library menu item
			assertMenuVisibility(popup, {
				library: true,
				pdf: false,
				epub: false,
				snapshot: false,
				anyReader: false
			});
			await simulateMenuClosed(popup);

			// Switch to PDF tab
			await ZoteroPane.viewItems([pdfItem]);
			let pdfTabID = Zotero_Tabs.selectedID;
			await Zotero.Reader.getByTabID(pdfTabID)._initPromise;
			await simulateMenuOpen(popup);
			// Should show PDF and anyReader menu items
			assertMenuVisibility(popup, {
				library: false,
				pdf: true,
				epub: false,
				snapshot: false,
				anyReader: true
			});
			await simulateMenuClosed(popup);

			// Switch to EPUB tab
			await ZoteroPane.viewItems([epubItem]);
			let epubTabID = Zotero_Tabs.selectedID;
			await Zotero.Reader.getByTabID(epubTabID)._initPromise;
			await simulateMenuOpen(popup);
			// Should show EPUB and anyReader menu items
			assertMenuVisibility(popup, {
				library: false,
				pdf: false,
				epub: true,
				snapshot: false,
				anyReader: true
			});
			await simulateMenuClosed(popup);

			// Switch to Snapshot tab
			await ZoteroPane.viewItems([snapshotItem]);
			let snapshotTabID = Zotero_Tabs.selectedID;
			await Zotero.Reader.getByTabID(snapshotTabID)._initPromise;
			await simulateMenuOpen(popup);
			// Should show Snapshot and anyReader menu items
			assertMenuVisibility(popup, {
				library: false,
				pdf: false,
				epub: false,
				snapshot: true,
				anyReader: true
			});
			await simulateMenuClosed(popup);

			// Unregister the menu
			assert.isTrue(Zotero.MenuManager.unregisterMenu(menuID));
		});

		it("should register recursive submenu", async function () {
			let testMenuClass = "test-recursive-submenu";
			let option = Object.assign({}, defaultOption, {
				target: "main/menubar/file",
				menus: [{
					menuType: "submenu",
					l10nID: "menu-print",
					onShowing: (event, context) => {
						context.menuElem?.classList.add(testMenuClass);
					},
					menus: [{
						menuType: "menuitem",
						l10nID: "menu-print",
						onShowing: (event, context) => {
							updateCache("onShowing", context);
						},
						onCommand: (event, context) => {
							updateCache("onCommand", context);
						}
					}]
				}]
			});

			initCache("onCommand");
			initCache("onShowing");

			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);

			let popup = doc.querySelector("#menu_FilePopup");

			await simulateMenuOpen(popup);

			// The onShowing hook of child menu should not be called yet
			assert.isEmpty(caches.onShowing.result, "Child menu onShowing should not be called yet");

			let submenu = popup.querySelector(`.${testMenuClass}`);
			assert.exists(submenu, "Submenu should be created");

			let submenuPopup = submenu.querySelector("menupopup");
			await simulateMenuOpen(submenuPopup);
			let context = await getCache("onShowing");
			assert.exists(context.menuElem, "Submenu onShowing context should have menuElem");

			await simulateMenuItemClick(context.menuElem);
			context = await getCache("onCommand");
			assert.exists(context, "Submenu command context should exist");

			assert.isTrue(Zotero.MenuManager.unregisterMenu(menuID));
		});

		it("should register main window menu", async function () {
			let menuTargetMap = {
				"main/menubar/file": "#menu_FilePopup",
				"main/menubar/edit": "#menu_EditPopup",
				"main/menubar/view": "#menu_viewPopup",
				"main/menubar/go": "#menu_goPopup",
				"main/menubar/tools": "#menu_ToolsPopup",
				"main/menubar/help": "#menu_HelpPopup",
			};
			
			let contextKeys = [
				...defaultContextKeys,
				"items",
			];

			for (let [target, popupSelector] of Object.entries(menuTargetMap)) {
				await checkMenuContext({ target }, popupSelector, contextKeys);
			}
		});

		it("should register library menu", async function () {
			let menuTargetMap = {
				"main/library/item": {
					popupSelector: () => {
						ZoteroPane.onItemsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
						return doc.querySelector("#zotero-itemmenu");
					},
					contextKeys: [
						...defaultContextKeys,
						"items",
						"collectionTreeRows",
					]
				},
				"main/library/collection": {
					popupSelector: () => {
						ZoteroPane.onCollectionsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
						return doc.querySelector("#zotero-collectionmenu");
					},
					contextKeys: [
						...defaultContextKeys,
						"collectionTreeRows",
					]
				},
				"main/library/addAttachment": {
					popupSelector: "#menu_attachmentAdd > menupopup",
					contextKeys: [
						...defaultContextKeys,
						"items",
					]
				},
				"main/library/addNote": {
					popupSelector: "#menu_noteAdd > menupopup",
					contextKeys: [
						...defaultContextKeys,
						"items",
					]
				}
			};

			for (let [target, { popupSelector, contextKeys }] of Object.entries(menuTargetMap)) {
				await checkMenuContext({ target }, popupSelector, contextKeys);
			}
		});

		it("should register other main window menus", async function () {
			let menuTargetMap = {
				"main/tab": {
					popupSelector: async () => {
						let tabID = Zotero_Tabs.selectedID;
						return Zotero_Tabs._openMenu(0, 0, tabID);
					},
					contextKeys: [
						...defaultContextKeys,
						"items"
					]
				},
				"itemPane/info/row": {
					popupSelector: async () => {
						let item = new Zotero.Item('book');
						await item.saveTx();
						await ZoteroPane.selectItem(item.id);
						let itemDetails = ZoteroPane.itemPane._itemDetails;
						let infoBox = itemDetails.getPane("info");
						let row = infoBox.querySelector("#itembox-field-value-title");
						row.focus();
						let event = new MouseEvent("contextmenu", {
							bubbles: true,
							cancelable: true,
						});
						row.dispatchEvent(event);
						let popup = infoBox.querySelector("#zotero-field-menu");
						return popup;
					},
					contextKeys: [
						...defaultContextKeys,
						"items",
						"editable",
						"fieldName",
						"targetElem"
					]
				},
				"sidenav/locate": {
					popupSelector: async () => {
						let item = new Zotero.Item('book');
						await item.saveTx();
						await ZoteroPane.selectItem(item.id);
						let sidenav = ZoteroPane.itemPane._sidenav;
						let button = sidenav.querySelector("toolbarbutton[data-action='locate']");
						let event = new MouseEvent("mousedown", {
							bubbles: true,
							cancelable: true,
						});
						button.dispatchEvent(event);
						let popup = button.querySelector("menupopup");
						return popup;
					},

					contextKeys: [
						...defaultContextKeys,
						"items",
					]
				}
			};

			for (let [target, { popupSelector, contextKeys }] of Object.entries(menuTargetMap)) {
				await checkMenuContext({ target }, popupSelector, contextKeys);
			}
		});

		it("should register note context menu", async function () {
			let menuTargetMap = {
				"notesPane/addItemNote": async () => {
					let button = notesList.querySelector(".item-notes .section-custom-button.add");
					let event = new MouseEvent("command", {
						bubbles: true,
						cancelable: true,
					});
					button.dispatchEvent(event);
					let popup = notesContext.querySelector(".context-pane-add-child-note-button-popup");
					return popup;
				},
				"notesPane/addStandaloneNote": async () => {
					let button = notesList.querySelector(".all-notes .section-custom-button.add");
					let event = new MouseEvent("command", {
						bubbles: true,
						cancelable: true,
					});
					button.dispatchEvent(event);
					let popup = notesContext.querySelector(".context-pane-add-standalone-note-button-popup");
					return popup;
				}
			};
			
			let item = new Zotero.Item('book');
			await item.saveTx();
			let pdfItem = await importFileAttachment('test.pdf', {
				parentItemID: item.id
			});
			await ZoteroPane.viewItems([pdfItem]);
			await Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)._initPromise;
			ZoteroContextPane.collapsed = false;
			ZoteroContextPane.sidenav._contextNotesPaneVisible = true;
			let contextPane = ZoteroContextPane.context;
			let notesContext = contextPane._getCurrentNotesContext();
			let notesList = notesContext.notesList;

			for (let [target, popupSelector] of Object.entries(menuTargetMap)) {
				await checkMenuContext({ target }, popupSelector);
			}
		});

		it("should register reader window menu", async function () {
			let mainMenubarTargetMap = {
				"reader/menubar/file": "#menu_FilePopup",
				"reader/menubar/edit": "#menu_EditPopup",
				"reader/menubar/view": "#menu_viewPopup",
				"reader/menubar/go": "#menu_goPopup",
				"reader/menubar/window": "#windowPopup",
			};

			let pdfAttachment = await importFileAttachment('test.pdf');
			let { instance: reader } = await Zotero.Reader.open(pdfAttachment.id, undefined, {
				openInWindow: true,
			});
			await reader._initPromise;
			
			let readerWin = reader._window;
			let readerDoc = readerWin.document;

			for (let [target, popupSelector] of Object.entries(mainMenubarTargetMap)) {
				await checkMenuContext({ target }, popupSelector, undefined, readerDoc);
			}

			reader.close();
		});

		it("should remove menu DOM elements on plugin shutdown", async function () {
			let pluginID = "test-plugin@zotero.org";
			let option = Object.assign({}, defaultOption, {
				pluginID,
				target: "main/menubar/file",
			});

			initCache("onShowing");
			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);

			let popup = doc.querySelector("#menu_FilePopup");
			await simulateMenuOpen(popup);
			await getCache("onShowing");

			let menuSelector = `.zotero-custom-menu-item.${CSS.escape(menuID)}`;
			assert.exists(popup.querySelector(menuSelector),
				"Menu element should exist after registration");

			await simulateMenuClosed(popup);

			await Zotero.MenuManager._menuManager._unregisterByPluginID(pluginID);

			assert.notExists(popup.querySelector(menuSelector),
				"Menu element should be removed after plugin shutdown");
		});

		it("should group custom menus", async function () {
			let option = Object.assign({}, defaultOption, {
				target: "main/library/item",
				menus: Array.from({length: 100}, () => ({
					menuType: "menuitem",
					l10nID: "menu-print",
				})),
			});

			initCache("onShowing");
			initCache("onCommand");

			let menuID = Zotero.MenuManager.registerMenu(option);
			assert.isString(menuID);

			let popup = doc.querySelector("#zotero-itemmenu");

			let promise = new Promise((resolve) => {
				popup.addEventListener("popupshown", resolve, { once: true });
			});

			ZoteroPane.onItemsContextMenuOpen(new MouseEvent("contextmenu"), 0, 0);
			await promise;

			let groupedMenus = popup.querySelector(".zotero-custom-menu-group-submenu");
			assert.exists(groupedMenus, "Grouped menus should be created");

			assert.isTrue(Zotero.MenuManager.unregisterMenu(menuID));
		});
	});

	describe("Custom button", function () {
		let defaultOption = {
			buttonID: "default-test",
			pluginID: "zotero@zotero.org",
			target: "main/library/toolbar",
			l10nID: "menu-print",
			icon: "chrome://zotero/skin/16/universal/plus.svg",
			onCommand: (context) => {
				updateCache("onCommand", context);
			},
		};

		function getToolbarButtonsElem() {
			return doc.querySelector("#zotero-tb-custom-buttons");
		}

		async function registerButton(option = {}) {
			option = Object.assign({}, defaultOption, option);
			let notifyPromise = waitForNotifierEvent("refresh", "custom-button");
			let buttonID = Zotero.ButtonManager.registerButton(option);
			assert.isString(buttonID);
			await notifyPromise;
			return buttonID;
		}

		async function unregisterButton(buttonID) {
			let notifyPromise = waitForNotifierEvent("refresh", "custom-button");
			assert.isTrue(Zotero.ButtonManager.unregisterButton(buttonID));
			await notifyPromise;
		}

		async function simulateMenuOpen(menu) {
			return new Promise((resolve) => {
				menu.addEventListener("popupshown", resolve, { once: true });
				menu.dispatchEvent(new MouseEvent("popupshowing"));
				menu.dispatchEvent(new MouseEvent("popupshown"));
			});
		}

		async function simulateMenuClosed(menu) {
			return new Promise((resolve) => {
				menu.addEventListener("popuphidden", resolve, { once: true });
				menu.dispatchEvent(new MouseEvent("popuphiding"));
				menu.dispatchEvent(new MouseEvent("popuphidden"));
			});
		}

		before(function () {
			Zotero_Tabs.select("zotero-pane");
		});

		beforeEach(function () {
			resetCaches();
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
		});

		it("should reject invalid options", function () {
			// Missing both onCommand and menus
			assert.isFalse(Zotero.ButtonManager.registerButton(
				Object.assign({}, defaultOption, { onCommand: undefined })
			));
			// Both onCommand and menus
			assert.isFalse(Zotero.ButtonManager.registerButton(
				Object.assign({}, defaultOption, {
					menus: [{ menuType: "menuitem", l10nID: "menu-print" }],
				})
			));
			// Empty menus
			assert.isFalse(Zotero.ButtonManager.registerButton(
				Object.assign({}, defaultOption, { onCommand: undefined, menus: [] })
			));
			// Invalid target
			assert.isFalse(Zotero.ButtonManager.registerButton(
				Object.assign({}, defaultOption, { target: "main/unknown" })
			));
		});

		it("should render a click button in the items toolbar", async function () {
			initCache("onCommand");
			let buttonID = await registerButton();

			let elem = getToolbarButtonsElem();
			let button = elem.querySelector(`.zotero-custom-button.${CSS.escape(buttonID)}`);
			assert.exists(button, "Button should be rendered in the items toolbar");
			assert.isFalse(button.hidden, "Button should be visible");

			button.dispatchEvent(new MouseEvent("command", { bubbles: true }));
			let context = await getCache("onCommand");
			assert.equal(context.tabType, "library");
			assert.equal(context.tabID, "zotero-pane");
			assert.isArray(context.itemIDs);

			await unregisterButton(buttonID);
			assert.notExists(
				elem.querySelector(`.${CSS.escape(buttonID)}`),
				"Button should be removed after unregistering"
			);
		});

		it("should render a dropdown button and populate its menu", async function () {
			initCache("onCommand");
			let buttonID = await registerButton({
				buttonID: "dropdown-test",
				onCommand: undefined,
				menus: [
					{
						menuType: "menuitem",
						l10nID: "menu-print",
						onCommand: (event, context) => {
							updateCache("onCommand", context);
						},
					},
				],
			});

			let elem = getToolbarButtonsElem();
			let button = elem.querySelector(`.zotero-custom-button.${CSS.escape(buttonID)}`);
			assert.exists(button, "Dropdown button should be rendered");
			assert.equal(button.getAttribute("type"), "menu");

			let popup = button.querySelector("menupopup");
			await simulateMenuOpen(popup);
			let menuItem = popup.querySelector(".zotero-custom-menu-item");
			assert.exists(menuItem, "Dropdown menu should contain the registered menu item");

			menuItem.dispatchEvent(new MouseEvent("command", { bubbles: false }));
			let context = await getCache("onCommand");
			assert.equal(context.tabType, "library");
			await simulateMenuClosed(popup);

			// The internal menu registration should be removed with the button
			let menuKey = Zotero.ButtonManager.getButtonOptions("main/library/toolbar")
				.find(option => option.buttonID === buttonID)._menuKey;
			assert.exists(Zotero.MenuManager._menuManager._optionsCache[menuKey]);
			await unregisterButton(buttonID);
			assert.notExists(Zotero.MenuManager._menuManager._optionsCache[menuKey]);
		});

		it("should collapse buttons into the overflow menu when space is not enough", async function () {
			initCache("onCommand");

			// Make sure the window is wide enough to show all buttons
			let originalWidth = win.outerWidth;
			if (originalWidth < 1200) {
				win.resizeTo(1200, win.outerHeight);
				await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
			}

			let menuIcon = "chrome://zotero/skin/16/universal/plus-circle.svg";
			let buttonIDs = [];
			for (let i = 0; i < 3; i++) {
				buttonIDs.push(await registerButton({
					buttonID: `overflow-test-${i}`,
					// The first button provides a dedicated overflow menu icon
					menuIcon: i === 0 ? menuIcon : undefined,
				}));
			}

			let elem = getToolbarButtonsElem();
			elem._updateOverflow();
			let initialCount = elem._visibleCount;
			assert.isAbove(initialCount, 0, "Some buttons should be visible initially");

			// Consume all free space in the toolbar to force a collapse. The resize
			// observer can't see pure content overflow (in real usage the toolbar
			// itself resizes), so run the overflow update manually
			let spacer = elem.previousElementSibling;
			let dummy = doc.createXULElement("box");
			dummy.style.minWidth = "10000px";
			dummy.style.flexShrink = "0";
			spacer.parentElement.insertBefore(dummy, spacer);
			try {
				elem._updateOverflow();
				let parentBox = elem.parentElement;
				let searchBox = doc.getElementById("zotero-tb-search");
				let diag = `spacer=${spacer.getBoundingClientRect().width}`
					+ ` search=${searchBox.getBoundingClientRect().width}`
					+ ` parentScroll=${parentBox.scrollWidth} parentClient=${parentBox.clientWidth}`
					+ ` elemW=${elem.getBoundingClientRect().width}`
					+ ` dummyW=${dummy.getBoundingClientRect().width}`;
				assert.equal(elem._visibleCount, 0, "All buttons should be collapsed: " + diag);
				let overflowButton = elem.querySelector(".zotero-custom-button-overflow");
				assert.isFalse(overflowButton.hidden, "Overflow button should be visible");

				let popup = overflowButton.querySelector("menupopup");
				await simulateMenuOpen(popup);
				let overflowItems = popup.querySelectorAll(".zotero-custom-button-overflow-item");
				assert.equal(overflowItems.length, 3, "All buttons should be in the overflow menu");

				// The dedicated menu icon should be preferred over the button icon
				assert.equal(
					overflowItems[0].style.getPropertyValue("--custom-menu-icon-light"),
					`url(${menuIcon})`
				);
				assert.equal(
					overflowItems[1].style.getPropertyValue("--custom-menu-icon-light"),
					`url(${defaultOption.icon})`
				);

				overflowItems[0].dispatchEvent(new MouseEvent("command", { bubbles: false }));
				let context = await getCache("onCommand");
				assert.equal(context.tabType, "library");
				await simulateMenuClosed(popup);
			}
			finally {
				dummy.remove();
			}

			// Buttons should expand again when the space is restored
			elem._updateOverflow();
			assert.equal(elem._visibleCount, initialCount,
				"Buttons should expand again after the space is restored");

			for (let buttonID of buttonIDs) {
				await unregisterButton(buttonID);
			}
			if (originalWidth < 1200) {
				win.resizeTo(originalWidth, win.outerHeight);
			}
		});

		it("should render buttons in the reader toolbar", async function () {
			initCache("onCommand");
			// Register a button before the reader is opened
			let buttonID = await registerButton({
				buttonID: "reader-test",
				target: "reader/toolbar",
				icon: "chrome://zotero/skin/16/universal/plus.svg",
				onCommand: (context) => {
					updateCache("onCommand", context);
				},
			});

			let pdfAttachment = await importFileAttachment("test.pdf");
			await ZoteroPane.viewItems([pdfAttachment]);
			let tabID = Zotero_Tabs.selectedID;
			let reader = Zotero.Reader.getByTabID(tabID);
			await reader._initPromise;

			let readerWin = reader._iframeWindow;
			let buttonSelector = `.zotero-custom-button.${CSS.escape(buttonID)}`;
			let button = await waitForCallback(
				() => readerWin.document.querySelector(buttonSelector), 50, 5);
			assert.exists(button, "Button should be rendered in the reader toolbar");

			button.click();
			let context = await getCache("onCommand");
			assert.equal(context.tabType, "reader");
			assert.equal(context.tabSubType, "pdf");
			assert.equal(context.tabID, tabID);
			assert.deepEqual(context.itemIDs, [pdfAttachment.id]);

			// Register another button while the reader is open
			let buttonID2 = await registerButton({
				buttonID: "reader-test-2",
				target: "reader/toolbar",
			});
			let button2Selector = `.zotero-custom-button.${CSS.escape(buttonID2)}`;
			let button2 = await waitForCallback(
				() => reader._iframeWindow.document.querySelector(button2Selector), 50, 5);
			assert.exists(button2, "Button registered while the reader is open should be rendered");

			// A button restricted to other reader types should not be rendered
			let buttonID3 = await registerButton({
				buttonID: "reader-test-3",
				target: "reader/toolbar",
				enableForTabTypes: ["reader/epub"],
			});
			let button3Selector = `.zotero-custom-button.${CSS.escape(buttonID3)}`;
			assert.notExists(reader._iframeWindow.document.querySelector(button3Selector),
				"Button for other reader types should not be rendered");

			await unregisterButton(buttonID);
			await waitForCallback(
				() => !reader._iframeWindow.document.querySelector(buttonSelector), 50, 5);
			await unregisterButton(buttonID2);
			await unregisterButton(buttonID3);

			Zotero_Tabs.close(tabID);
		});

		it("should not let the search box internals overflow while collapsing", async function () {
			// Make sure the window is wide enough to show all buttons
			let originalWidth = win.outerWidth;
			if (originalWidth < 1200) {
				win.resizeTo(1200, win.outerHeight);
				await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
			}
			let ids = [];
			for (let i = 0; i < 3; i++) {
				ids.push(await registerButton({ buttonID: `squeeze-test-${i}` }));
			}
			let elem = getToolbarButtonsElem();
			let spacer = elem.previousElementSibling;
			let search = doc.getElementById("zotero-tb-search");
			let advancedButton = search.querySelector("#zotero-tb-search-advanced-button");
			// Simulate a locale where the input's intrinsic width (font-metric
			// dependent) exceeds the search box's flex basis
			let inputField = search.searchTextbox.inputField;
			inputField.setAttribute("size", "40");
			let dummy = doc.createXULElement("box");
			dummy.style.flexShrink = "0";
			spacer.parentElement.insertBefore(dummy, spacer);
			try {
				// Gradually squeeze the toolbar and make sure the search box
				// internals never stick out of the search box
				for (let w = 0; w <= 500; w += 10) {
					dummy.style.minWidth = w + "px";
					elem._updateOverflow();
					let stickOut = advancedButton.getBoundingClientRect().right
						- search.getBoundingClientRect().right;
					assert.isAtMost(stickOut, 1,
						`Search box internals should not overflow at squeeze width ${w}`);
				}
			}
			finally {
				inputField.removeAttribute("size");
				dummy.remove();
				for (let id of ids) {
					await unregisterButton(id);
				}
				if (originalWidth < 1200) {
					win.resizeTo(originalWidth, win.outerHeight);
				}
			}
		});

		it("should support keyboard navigation through the toolbar buttons", async function () {
			// Make sure the window is wide enough to show all buttons
			let originalWidth = win.outerWidth;
			if (originalWidth < 1200) {
				win.resizeTo(1200, win.outerHeight);
				await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
			}
			let buttonIDs = [];
			for (let i = 0; i < 2; i++) {
				buttonIDs.push(await registerButton({ buttonID: `keynav-test-${i}` }));
			}
			let elem = getToolbarButtonsElem();
			let buttons = elem.querySelectorAll(".zotero-custom-button");
			let noteAdd = doc.getElementById("zotero-tb-note-add");
			let pressKey = (target, key) => {
				target.focus();
				target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
			};

			// Arrow from the New Note button into the custom buttons and back
			pressKey(noteAdd, Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[0]);
			pressKey(buttons[0], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[0]);
			pressKey(buttons[0], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, noteAdd);

			for (let buttonID of buttonIDs) {
				await unregisterButton(buttonID);
			}
			if (originalWidth < 1200) {
				win.resizeTo(originalWidth, win.outerHeight);
			}
		});

		it("should compute the visible button count with hysteresis", function () {
			let compute = (budget, currentCount) => Zotero.ButtonManager._readerRenderer
				._computeVisibleCount([36, 36, 36], 40, budget, currentCount, 0);

			// Everything fits
			assert.equal(compute(108, 3), 3);
			// Not enough for all -- two buttons + chevron (112) don't fit either,
			// so only one button + chevron (76) remains
			assert.equal(compute(107, 3), 1);
			// All three buttons (108) still fit
			assert.equal(compute(112, 3), 3);
			// Only the chevron fits
			assert.equal(compute(41, 3), 0);
			// Don't expand without comfortable extra space
			assert.equal(compute(112, 2), 2);
			// Expand when there's enough space
			assert.equal(compute(108 + 24, 2), 3);
		});

		it("should render buttons in the title bar", async function () {
			initCache("onCommand");
			let buttonID = await registerButton({
				buttonID: "tabs-toolbar-test",
				target: "main/titlebar",
			});

			let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
			let button = elem.querySelector(`.zotero-custom-button.${CSS.escape(buttonID)}`);
			assert.exists(button, "Button should be rendered in the title bar");
			assert.isFalse(button.hidden, "Button should be visible");
			assert.equal(elem.nextElementSibling.id, "zotero-tb-tabs-menu",
				"Buttons should be rendered before the tabs menu button");

			button.dispatchEvent(new MouseEvent("command", { bubbles: true }));
			let context = await getCache("onCommand");
			assert.equal(context.tabType, "library");
			assert.equal(context.tabID, "zotero-pane");
			assert.isArray(context.itemIDs);

			await unregisterButton(buttonID);
			assert.notExists(
				elem.querySelector(`.${CSS.escape(buttonID)}`),
				"Button should be removed after unregistering"
			);
		});

		it("should collapse title bar buttons when the tab bar lacks space", async function () {
			// Make sure the window is wide enough to show all buttons
			let originalWidth = win.outerWidth;
			if (originalWidth < 1200) {
				win.resizeTo(1200, win.outerHeight);
				await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
			}

			let buttonIDs = [];
			for (let i = 0; i < 3; i++) {
				buttonIDs.push(await registerButton({
					buttonID: `tabs-overflow-test-${i}`,
					target: "main/titlebar",
				}));
			}

			let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
			elem._updateOverflow();
			let initialCount = elem._visibleCount;
			assert.isAbove(initialCount, 0, "Some buttons should be visible initially");

			// Consume the tab bar's free space to force a collapse. The resize
			// observer path is skipped while the pointer might be over the tab
			// bar, so run the overflow update manually
			let dummy = doc.createXULElement("box");
			dummy.style.minWidth = "10000px";
			dummy.style.flexShrink = "0";
			elem.parentElement.appendChild(dummy);
			try {
				elem._updateOverflow();
				assert.equal(elem._visibleCount, 0, "All buttons should be collapsed");
				let overflowButton = elem.querySelector(".zotero-custom-button-overflow");
				assert.isFalse(overflowButton.hidden, "Overflow button should be visible");

				let popup = overflowButton.querySelector("menupopup");
				await simulateMenuOpen(popup);
				let overflowItems = popup.querySelectorAll(".zotero-custom-button-overflow-item");
				assert.equal(overflowItems.length, 3, "All buttons should be in the overflow menu");
				await simulateMenuClosed(popup);
			}
			finally {
				dummy.remove();
			}

			// Buttons should expand again when the space is restored
			elem._updateOverflow();
			assert.equal(elem._visibleCount, initialCount,
				"Buttons should expand again after the space is restored");

			for (let buttonID of buttonIDs) {
				await unregisterButton(buttonID);
			}
			if (originalWidth < 1200) {
				win.resizeTo(originalWidth, win.outerHeight);
			}
		});

		it("should support keyboard navigation in the title bar", async function () {
			// Make sure the window is wide enough to show all buttons
			let originalWidth = win.outerWidth;
			if (originalWidth < 1200) {
				win.resizeTo(1200, win.outerHeight);
				await waitForCallback(() => win.outerWidth >= 1150, 50, 3).catch(() => {});
			}
			let buttonIDs = [];
			for (let i = 0; i < 2; i++) {
				buttonIDs.push(await registerButton({
					buttonID: `tabs-keynav-test-${i}`,
					target: "main/titlebar",
				}));
			}
			let elem = doc.querySelector("#zotero-titlebar-custom-buttons");
			elem._updateOverflow();
			let buttons = elem.querySelectorAll(".zotero-custom-button");
			let tabsMenu = doc.getElementById("zotero-tb-tabs-menu");
			let pressKey = (target, key) => {
				target.focus();
				target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
			};

			// Arrow through the custom buttons into the tabs menu button and back
			pressKey(buttons[0], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowNextKey);
			assert.equal(doc.activeElement, tabsMenu);
			pressKey(tabsMenu, Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[1]);
			pressKey(buttons[1], Zotero.arrowPreviousKey);
			assert.equal(doc.activeElement, buttons[0]);

			for (let buttonID of buttonIDs) {
				await unregisterButton(buttonID);
			}
			if (originalWidth < 1200) {
				win.resizeTo(originalWidth, win.outerHeight);
			}
		});

		describe("unprivileged plugin restrictions", function () {
			var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
			const UNPRIV_ID = "test-button-unpriv@zotero.org";
			const UNPRIV_GUID = "{00000000-0000-0000-0000-000000000031}";
			var tmpDir;

			function ownURL(fileName) {
				return WebExtensionPolicy.getByID(UNPRIV_ID).getURL(fileName);
			}

			before(async function () {
				tmpDir = PathUtils.join(Zotero.getTempDirectory().path, "button-" + Zotero.Utilities.randomString());
				await IOUtils.makeDirectory(tmpDir);
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "icon.svg"),
					"<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>"
				);
			});

			after(async function () {
				await IOUtils.remove(tmpDir, { recursive: true, ignoreAbsent: true });
			});

			beforeEach(function () {
				PluginSandbox.loadScope(createMockPlugin({
					id: UNPRIV_ID,
					name: "Button Unpriv",
					syncGUID: UNPRIV_GUID,
					permissions: ["default", "ui"],
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				}));
			});

			afterEach(function () {
				try {
					PluginSandbox.unloadScope(UNPRIV_ID);
				}
				catch {}
			});

			it("passes a single context arg without buttonElem to onCommand", async function () {
				let received;
				let notifyPromise = waitForNotifierEvent("refresh", "custom-button");
				let buttonID = Zotero.ButtonManager.registerButton({
					buttonID: "unpriv-context",
					pluginID: UNPRIV_ID,
					target: "main/library/toolbar",
					l10nID: "menu-print",
					icon: ownURL("icon.svg"),
					onCommand: (...args) => {
						received = args;
					},
				});
				assert.isString(buttonID);
				await notifyPromise;

				let button = getToolbarButtonsElem()
					.querySelector(`.zotero-custom-button.${CSS.escape(buttonID)}`);
				assert.exists(button);
				button.dispatchEvent(new MouseEvent("command", { bubbles: true }));

				assert.lengthOf(received, 1, "onCommand should get a single context arg");
				assert.property(received[0], "itemIDs");

				let unregNotifyPromise = waitForNotifierEvent("refresh", "custom-button");
				assert.isTrue(Zotero.ButtonManager.unregisterButton(buttonID, UNPRIV_ID));
				await unregNotifyPromise;
			});

			it("rejects buttons with disallowed icon URLs", function () {
				let register = icon => Zotero.ButtonManager.registerButton({
					buttonID: "icon-test",
					pluginID: UNPRIV_ID,
					target: "main/library/toolbar",
					l10nID: "menu-print",
					icon,
					onCommand: () => {},
				});
				// javascript: is unsafe regardless of origin
				assert.isFalse(register("javascript:alert(1)"));
				// An undeclared remote origin (no host_permissions)
				assert.isFalse(register("https://evil.example.com/icon.svg"));
				// Another plugin's moz-extension resource
				assert.isFalse(register("moz-extension://00000000-0000-0000-0000-000000000099/x.svg"));
				// The plugin's own resource is allowed
				let id = register(ownURL("icon.svg"));
				assert.isString(id);
				Zotero.ButtonManager.unregisterButton(id, UNPRIV_ID);
			});
		});
	});

	describe("Shortcut manager", function () {
		let defaultOption = {
			shortcutID: "default-test",
			pluginID: "zotero@zotero.org",
			key: "Y",
			modifiers: ["accel", "alt"],
			target: "mainWindow",
			onCommand: (context) => {
				updateCache("onCommand", context);
			},
		};

		function registerShortcut(option = {}) {
			return Zotero.ShortcutManager.registerShortcut(
				Object.assign({}, defaultOption, option)
			);
		}

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

		before(function () {
			Zotero_Tabs.select("zotero-pane");
		});

		beforeEach(function () {
			resetCaches();
		});

		afterEach(function () {
			Zotero_Tabs.select("zotero-pane");
			Zotero_Tabs.closeAll();
		});

		it("should reject invalid combos", function () {
			// No accel/alt modifier
			assert.isFalse(registerShortcut({ modifiers: ["shift"] }));
			// Unknown modifier
			assert.isFalse(registerShortcut({ modifiers: ["accel", "ctrl"] }));
			// Navigation key
			assert.isFalse(registerShortcut({ key: "Enter", modifiers: ["accel", "alt"] }));
			// Missing onCommand
			assert.isFalse(registerShortcut({ onCommand: undefined }));
		});

		it("should reject combos reserved by Zotero", function () {
			// Static list (close tab)
			assert.isFalse(registerShortcut({ key: "W", modifiers: ["accel"] }));
			// A built-in registration's combo (quicksearch, accel+shift+K) is not
			// reserved -- sharing it fires alongside the built-in instead
			let sharedID = registerShortcut({ key: "K", modifiers: ["accel", "shift"] });
			assert.isString(sharedID);
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(sharedID));
			// Built-ins with display-only <key> elements are plain registrations too --
			// shareable, not reserved (advanced search)
			let advancedSearchID = registerShortcut({
				shortcutID: "shared-key-element-test",
				key: "F",
				modifiers: ["accel", "shift"],
			});
			assert.isString(advancedSearchID);
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(advancedSearchID));
		});

		it("should fire every shortcut sharing a combo", async function () {
			initCache("onCommand");
			let secondCalled = false;
			let firstID = registerShortcut();
			let secondID = registerShortcut({
				shortcutID: "duplicate-test",
				onCommand: () => {
					secondCalled = true;
				},
			});
			assert.isString(secondID);

			let event = dispatchKey("y", { accel: true, alt: true });
			await getCache("onCommand");
			assert.isTrue(secondCalled);
			assert.isTrue(event.defaultPrevented);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(firstID));
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(secondID));
		});

		it("should consume the event unless every handler declines", function () {
			let calls = [];
			let firstID = registerShortcut({
				onCommand: () => {
					calls.push("first");
					return false;
				},
			});

			// With every handler declining, the event propagates
			let event = dispatchKey("y", { accel: true, alt: true });
			assert.deepEqual(calls, ["first"]);
			assert.isFalse(event.defaultPrevented);

			// One handling registration is enough to consume it
			let secondID = registerShortcut({
				shortcutID: "decline-test",
				onCommand: () => {
					calls.push("second");
				},
			});
			event = dispatchKey("y", { accel: true, alt: true });
			assert.deepEqual(calls, ["first", "first", "second"]);
			assert.isTrue(event.defaultPrevented);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(firstID));
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(secondID));
		});

		it("should call onCommand with tab context and consume the event", async function () {
			initCache("onCommand");
			let shortcutID = registerShortcut();

			let event = dispatchKey("y", { accel: true, alt: true });
			let context = await getCache("onCommand");
			assert.equal(context.tabType, "library");
			assert.equal(context.tabID, "zotero-pane");
			assert.isArray(context.itemIDs);
			assert.isArray(context.collectionIDs);
			assert.isTrue(event.defaultPrevented);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
			let newEvent = dispatchKey("y", { accel: true, alt: true });
			assert.isFalse(newEvent.defaultPrevented);
		});

		it("should not fire when the event default is already prevented", function () {
			let called = false;
			let shortcutID = registerShortcut({
				onCommand: () => {
					called = true;
				},
			});

			let pane = doc.getElementById("zotero-pane");
			pane.addEventListener("keydown", event => event.preventDefault(), { once: true });
			dispatchKey("y", { accel: true, alt: true });
			assert.isFalse(called);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
		});

		it("should scope reserved combos to their window target", function () {
			// Tab jumping is reserved in the main window only
			assert.isFalse(registerShortcut({ key: "1", modifiers: ["accel"] }));
			let shortcutID = registerShortcut({
				key: "1",
				modifiers: ["accel"],
				target: "readerWindow",
			});
			assert.isString(shortcutID);
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
		});

		it("should report combo conflicts via checkShortcut", function () {
			let manager = Zotero.ShortcutManager;
			let reasons = manager.rejectReasons;
			let check = (key, modifiers, target = "mainWindow") => manager.checkShortcut({ key, modifiers, target });
			assert.equal(check("Y", ["accel", "alt"]), reasons.NONE);
			assert.equal(check("Enter", ["accel"]), reasons.INVALID);
			assert.equal(check("Y", ["accel"], "main"), reasons.INVALID);
			// Target is required
			assert.equal(manager.checkShortcut({ key: "Y", modifiers: ["accel", "alt"] }), reasons.INVALID);
			// Static reserved (close tab)
			assert.equal(check("W", ["accel"]), reasons.RESERVED);
			// Built-in registration (quicksearch)
			assert.equal(check("K", ["accel", "shift"]), reasons.REGISTERED);
			// Reservation is target-scoped: tab jumping is main-window-only
			assert.equal(check("1", ["accel"]), reasons.RESERVED);
			assert.equal(
				manager.checkShortcut({ key: "1", modifiers: ["accel"], target: "readerWindow" }),
				reasons.NONE
			);
		});

		it("should reject an invalid or missing target", function () {
			assert.isFalse(registerShortcut({ target: "main" }));
			assert.isFalse(registerShortcut({ target: ["mainWindow"] }));
			assert.isFalse(registerShortcut({ target: undefined }));
		});

		it("should fire in a reader window with the readerWindow target", async function () {
			initCache("onCommand");
			let shortcutID = registerShortcut({
				target: "readerWindow",
			});
			assert.isString(shortcutID);
			// The same combo can be registered separately per target
			let mainSideID = registerShortcut({ shortcutID: "main-side-test" });
			assert.isString(mainSideID);
			let mainOnlyCalled = false;
			let mainOnlyID = registerShortcut({
				shortcutID: "main-only-test",
				key: "E",
				modifiers: ["accel", "alt"],
				onCommand: () => {
					mainOnlyCalled = true;
				},
			});
			assert.isString(mainOnlyID);

			let pdfAttachment = await importFileAttachment("test.pdf");
			let { instance: reader } = await Zotero.Reader.open(pdfAttachment.id, undefined, {
				openInWindow: true,
			});
			await reader._initPromise;
			let readerWin = reader._window;

			function dispatchInReaderWin(key) {
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
			}

			let event = dispatchInReaderWin("y");
			let context = await getCache("onCommand");
			assert.isTrue(event.defaultPrevented);
			assert.equal(context.tabType, "reader");
			assert.equal(context.tabSubType, "pdf");
			assert.isUndefined(context.tabID);
			assert.deepEqual(context.itemIDs, [pdfAttachment.id]);

			// A mainWindow-only shortcut passes through in the reader window
			let mainOnlyEvent = dispatchInReaderWin("e");
			assert.isFalse(mainOnlyCalled);
			assert.isFalse(mainOnlyEvent.defaultPrevented);

			reader.close();
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(mainSideID));
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(mainOnlyID));
		});

		it("should unregister shortcuts on plugin shutdown", async function () {
			let pluginID = "test-plugin@zotero.org";
			let called = false;
			let shortcutID = Zotero.ShortcutManager.registerShortcut(
				Object.assign({}, defaultOption, {
					pluginID,
					onCommand: () => {
						called = true;
					},
				})
			);
			assert.isString(shortcutID);
			assert.isTrue(Zotero.Shortcuts.isRegistered("accel+alt+Y", ["mainWindow"]));

			await Zotero.ShortcutManager._shortcutManager._unregisterByPluginID(pluginID);

			assert.isFalse(Zotero.Shortcuts.isRegistered("accel+alt+Y", ["mainWindow"]));
			let event = dispatchKey("y", { accel: true, alt: true });
			assert.isFalse(called);
			assert.isFalse(event.defaultPrevented);
		});

		it("should support the literal control modifier", function () {
			let called = false;
			let shortcutID = registerShortcut({
				key: "J",
				modifiers: ["control"],
				onCommand: () => {
					called = true;
				},
			});
			assert.isString(shortcutID);

			// ctrlKey maps to control on mac and to accel (folded) elsewhere, so the
			// same physical Ctrl+J fires on every platform
			let event = new win.KeyboardEvent("keydown", {
				key: "j",
				ctrlKey: true,
				bubbles: true,
				cancelable: true,
			});
			doc.getElementById("zotero-pane").dispatchEvent(event);
			assert.isTrue(called);
			assert.isTrue(event.defaultPrevented);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
		});

		it("should match letters by the layout-aware keyCode when event.key diverges", function () {
			let count = 0;
			let shortcutID = registerShortcut({
				onCommand: () => {
					count++;
				},
			});

			function dispatchWithKeyCode(key) {
				let event = new win.KeyboardEvent("keydown", {
					key,
					keyCode: 89, // Y
					metaKey: Zotero.isMac,
					ctrlKey: !Zotero.isMac,
					altKey: true,
					bubbles: true,
					cancelable: true,
				});
				doc.getElementById("zotero-pane").dispatchEvent(event);
				return event;
			}

			// mac Option composes event.key (alt+Y gives "¥" on a US layout), but
			// Gecko's keyCode still holds the layout's unshifted Latin letter
			let event = dispatchWithKeyCode("¥");
			assert.equal(count, 1);
			assert.isTrue(event.defaultPrevented);

			// Non-Latin layouts produce non-ASCII event.key; Gecko latinizes keyCode
			// (here: the Cyrillic character on the Y key of a Russian layout)
			event = dispatchWithKeyCode("н");
			assert.equal(count, 2);
			assert.isTrue(event.defaultPrevented);

			// Both candidate interpretations fire, consistent with combo sharing
			let composedCalled = false;
			let composedID = registerShortcut({
				shortcutID: "composed-test",
				key: "¥",
				onCommand: () => {
					composedCalled = true;
				},
			});
			dispatchWithKeyCode("¥");
			assert.equal(count, 3);
			assert.isTrue(composedCalled);
			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(composedID));

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
		});

		it("should match digit combos by physical key", async function () {
			initCache("onCommand");
			let shortcutID = registerShortcut({ key: "5", modifiers: ["accel", "alt"] });

			let event = new win.KeyboardEvent("keydown", {
				key: "∞",
				code: "Digit5",
				metaKey: Zotero.isMac,
				ctrlKey: !Zotero.isMac,
				altKey: true,
				bubbles: true,
				cancelable: true,
			});
			doc.getElementById("zotero-pane").dispatchEvent(event);
			await getCache("onCommand");
			assert.isTrue(event.defaultPrevented);

			assert.isTrue(Zotero.ShortcutManager.unregisterShortcut(shortcutID));
		});
	});

	describe("Reader manager", function () {
		var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
		// A pluginID with no loaded sandbox scope is treated as privileged, so
		// hooks receive raw (unwrapped) objects
		const PRIV_ID = "reader-test@zotero.org";

		// The reader's event.doc is a content document, so mimic it with a non-remote
		// type=content browser (an about:blank iframe would inherit the system principal).
		var readerBrowser;
		before(async function () {
			readerBrowser = doc.createXULElement("browser");
			readerBrowser.setAttribute("type", "content");
			doc.documentElement.appendChild(readerBrowser);
			// A fresh browser starts on a system-principal about:blank; navigate it
			// to a stable content (data:) document so its principal isn't system
			readerBrowser.loadURI(
				Services.io.newURI("data:text/html,<!DOCTYPE html><title>reader</title>"),
				{ triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }
			);
			for (let i = 0; i < 200 && !(readerBrowser.contentDocument
				&& readerBrowser.contentWindow
				&& readerBrowser.contentDocument.nodePrincipal
				&& !readerBrowser.contentDocument.nodePrincipal.isSystemPrincipal); i++) {
				await Zotero.Promise.delay(10);
			}
			assert.isFalse(readerBrowser.contentDocument.nodePrincipal.isSystemPrincipal,
				"test reader doc should be a content document");
		});

		after(function () {
			readerBrowser.remove();
		});

		// Simulate a reader dispatching an event; re-read the live contentDocument
		// each call so it can't go stale.
		function dispatchReaderEvent(type, { params = {}, reader = { itemID: 1, tabID: "tab-1", type: "pdf" } } = {}) {
			let appended = [];
			Zotero.Reader._dispatchEvent({
				type,
				reader,
				doc: readerBrowser.contentDocument,
				params,
				append: (...args) => appended.push(...args),
			});
			return appended;
		}

		describe("Sections", function () {
			// A section's src must resolve to the plugin's own page, so register a
			// moz-extension protocol; with no sandbox scope it's treated as privileged.
			const SEC_ID = "reader-section@zotero.org";
			var PluginProtocol, secBase, secTmpDir;

			before(async function () {
				PluginProtocol = ChromeUtils.importESModule(
					"chrome://zotero/content/xpcom/plugins/protocol.mjs"
				).PluginProtocol;
				let PluginUUID = ChromeUtils.importESModule(
					"chrome://zotero/content/xpcom/plugins/uuid.mjs"
				).PluginUUID;
				secTmpDir = PathUtils.join(Zotero.getTempDirectory().path, "reader-sec-" + Zotero.Utilities.randomString());
				await IOUtils.makeDirectory(secTmpDir);
				secBase = PluginProtocol.register(
					SEC_ID, Services.io.newURI(PathUtils.toFileURI(secTmpDir) + "/"), PluginUUID.getByID(SEC_ID)
				);
			});

			after(async function () {
				PluginProtocol.unregister(SEC_ID);
				await IOUtils.remove(secTmpDir, { recursive: true, ignoreAbsent: true });
			});

			afterEach(function () {
				for (let option of Zotero.ReaderManager._sectionManager.options) {
					Zotero.ReaderManager.unregisterSection(option.sectionID);
				}
			});

			it("hosts the plugin page in an iframe appended to the popup", function () {
				let sectionID = Zotero.ReaderManager.registerSection({
					sectionID: "sec-iframe",
					pluginID: SEC_ID,
					target: "textSelectionPopup",
					src: "popup.html",
					onRender() {},
				});
				assert.isString(sectionID);

				let appended = dispatchReaderEvent("renderTextSelectionPopup");
				assert.lengthOf(appended, 1);
				let iframe = appended[0];
				assert.equal(iframe.tagName.toLowerCase(), "iframe");
				assert.include(iframe.className, "zotero-reader-custom-section");
				assert.include(iframe.className, sectionID);
				// src resolves to the plugin's own page -- no token in the URL, since
				// messaging goes through the ZoteroEmbeddedPluginPage actor
				assert.equal(iframe.getAttribute("src"), secBase + "popup.html");
				// The section takes no explicit size -- it always follows the page's height
				assert.equal(iframe.style.height, "");
			});

			it("renders a section with no onRender at the plain page URL", function () {
				Zotero.ReaderManager.registerSection({
					sectionID: "sec-nohook",
					pluginID: SEC_ID,
					target: "textSelectionPopup",
					src: "popup.html",
				});
				let iframe = dispatchReaderEvent("renderTextSelectionPopup")[0];
				assert.equal(iframe.getAttribute("src"), secBase + "popup.html");
			});

			it("requires a src that resolves to a plugin .html page", function () {
				assert.isFalse(Zotero.ReaderManager.registerSection({
					sectionID: "no-src", pluginID: SEC_ID, target: "textSelectionPopup",
				}), "missing src");
				assert.isFalse(Zotero.ReaderManager.registerSection({
					sectionID: "not-html", pluginID: SEC_ID, target: "textSelectionPopup", src: "data.json",
				}), "non-.html src");
				assert.isFalse(Zotero.ReaderManager.registerSection({
					sectionID: "escape", pluginID: SEC_ID, target: "textSelectionPopup", src: "https://evil.example.com/x.html",
				}), "src outside the plugin");
			});

			it("does not render after unregister", function () {
				let sectionID = Zotero.ReaderManager.registerSection({
					sectionID: "sec-unreg",
					pluginID: SEC_ID,
					target: "textSelectionPopup",
					src: "popup.html",
				});
				assert.isTrue(Zotero.ReaderManager.unregisterSection(sectionID));
				assert.lengthOf(dispatchReaderEvent("renderTextSelectionPopup"), 0);
			});

			it("rejects removed/invalid section targets", function () {
				// toolbar (Button API's job) and sidebarAnnotationHeader were removed
				for (let target of ["toolbar", "sidebarAnnotationHeader", "bogus"]) {
					assert.isFalse(Zotero.ReaderManager.registerSection({
						sectionID: "bad-" + target,
						pluginID: SEC_ID,
						target,
						src: "popup.html",
					}), target);
				}
			});

			it("does not fire for a non-matching reader event", function () {
				Zotero.ReaderManager.registerSection({
					sectionID: "sec-nomatch",
					pluginID: SEC_ID,
					target: "textSelectionPopup",
					src: "popup.html",
				});
				assert.lengthOf(dispatchReaderEvent("renderToolbar"), 0);
				assert.lengthOf(dispatchReaderEvent("renderSidebarAnnotationHeader"), 0);
			});
		});

		// Messaging and sizing aren't unit-testable here (the actor transport can't be
		// driven by a synthetic postMessage); both are covered e2e in pluginSandboxTest.

		describe("Context menu items", function () {
			afterEach(function () {
				for (let option of Zotero.ReaderManager._contextMenuManager.options) {
					Zotero.ReaderManager.unregisterContextMenuItem(option.menuItemID);
				}
			});

			it("appends a registered item and passes context to onCommand", function () {
				let commandCtx;
				let id = Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "item-cmd",
					pluginID: PRIV_ID,
					target: "annotationContextMenu",
					label: "Do it",
					onCommand(ctx) {
						commandCtx = ctx;
					},
				});
				assert.isString(id);

				let appended = dispatchReaderEvent("createAnnotationContextMenu", {
					params: { ids: ["a", "b"] },
				});
				assert.lengthOf(appended, 1);
				let item = appended[0];
				assert.equal(item.label, "Do it");
				assert.isFunction(item.onCommand);
				assert.isFalse(item.disabled);

				item.onCommand();
				assert.equal(commandCtx.params.ids.length, 2);
				assert.equal(commandCtx.itemID, 1);
			});

			it("applies onShowing label/disabled overrides", function () {
				Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "item-showing",
					pluginID: PRIV_ID,
					target: "annotationContextMenu",
					label: "Static",
					onCommand() {},
					onShowing(ctx) {
						return { label: "Dynamic " + ctx.params.ids.length, disabled: true };
					},
				});
				let appended = dispatchReaderEvent("createAnnotationContextMenu", {
					params: { ids: ["x"] },
				});
				assert.equal(appended[0].label, "Dynamic 1");
				assert.isTrue(appended[0].disabled);
			});

			it("omits an item whose onShowing returns false", function () {
				Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "item-hidden",
					pluginID: PRIV_ID,
					target: "annotationContextMenu",
					label: "Hidden",
					onCommand() {},
					onShowing() {
						return false;
					},
				});
				assert.lengthOf(dispatchReaderEvent("createAnnotationContextMenu"), 0);
			});

			it("groups items from the same event into one append call", function () {
				Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "grp-a", pluginID: PRIV_ID, target: "colorContextMenu", label: "A", onCommand() {},
				});
				Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "grp-b", pluginID: PRIV_ID, target: "colorContextMenu", label: "B", onCommand() {},
				});
				assert.lengthOf(dispatchReaderEvent("createColorContextMenu"), 2);
			});

			it("routes items only to their own menu target", function () {
				Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "route-thumb", pluginID: PRIV_ID, target: "thumbnailContextMenu", label: "T", onCommand() {},
				});
				assert.lengthOf(dispatchReaderEvent("createSelectorContextMenu"), 0);
				assert.lengthOf(dispatchReaderEvent("createThumbnailContextMenu"), 1);
			});

			it("rejects invalid targets and missing required fields", function () {
				assert.isFalse(Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "bad-target", pluginID: PRIV_ID, target: "bogus", label: "x", onCommand() {},
				}));
				assert.isFalse(Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "no-label", pluginID: PRIV_ID, target: "colorContextMenu", onCommand() {},
				}));
				assert.isFalse(Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "no-command", pluginID: PRIV_ID, target: "colorContextMenu", label: "x",
				}));
			});
		});

		describe("unprivileged plugin restrictions", function () {
			const UNPRIV_ID = "reader-unpriv@zotero.org";
			const UNPRIV_GUID = "{00000000-0000-0000-0000-000000000041}";
			var tmpDir;

			function ownURL(fileName) {
				return WebExtensionPolicy.getByID(UNPRIV_ID).getURL(fileName);
			}

			before(async function () {
				tmpDir = PathUtils.join(Zotero.getTempDirectory().path, "reader-" + Zotero.Utilities.randomString());
				await IOUtils.makeDirectory(tmpDir);
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "icon.svg"),
					"<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/>"
				);
			});

			after(async function () {
				await IOUtils.remove(tmpDir, { recursive: true, ignoreAbsent: true });
			});

			beforeEach(function () {
				PluginSandbox.loadScope(createMockPlugin({
					id: UNPRIV_ID,
					name: "Reader Unpriv",
					syncGUID: UNPRIV_GUID,
					permissions: ["default", "ui"],
					resourceURI: PathUtils.toFileURI(tmpDir) + "/",
				}));
			});

			afterEach(function () {
				for (let option of Zotero.ReaderManager._sectionManager.options) {
					Zotero.ReaderManager.unregisterSection(option.sectionID);
				}
				for (let option of Zotero.ReaderManager._contextMenuManager.options) {
					Zotero.ReaderManager.unregisterContextMenuItem(option.menuItemID);
				}
				try {
					PluginSandbox.unloadScope(UNPRIV_ID);
				}
				catch {}
			});

			it("exposes Zotero.ReaderManager but not Zotero.Reader in the sandbox", function () {
				let scope = PluginSandbox.getScope(UNPRIV_ID);
				assert.equal(Cu.evalInSandbox("typeof Zotero.ReaderManager.registerSection", scope), "function");
				assert.equal(Cu.evalInSandbox("typeof Zotero.ReaderManager.registerContextMenuItem", scope), "function");
				// The raw reader event API (direct reader DOM) is privileged-only
				assert.equal(Cu.evalInSandbox("typeof Zotero.Reader", scope), "undefined");
			});

			it("renders an unprivileged section as an iframe of the plugin's own page", function () {
				let base = WebExtensionPolicy.getByID(UNPRIV_ID).getURL("");
				Zotero.ReaderManager.registerSection({
					sectionID: "u-sec",
					pluginID: UNPRIV_ID,
					target: "textSelectionPopup",
					src: "popup.html",
				});
				let appended = dispatchReaderEvent("renderTextSelectionPopup", {
					params: { annotation: { text: "hi" } },
				});
				assert.lengthOf(appended, 1);
				let iframe = appended[0];
				// Chrome builds the iframe; the plugin gets no reader DOM at all
				assert.equal(iframe.tagName.toLowerCase(), "iframe");
				assert.equal(iframe.getAttribute("src").split("#")[0], base + "popup.html");
			});

			it("rejects context-menu items with disallowed icon URLs", function () {
				let register = icon => Zotero.ReaderManager.registerContextMenuItem({
					menuItemID: "u-icon",
					pluginID: UNPRIV_ID,
					target: "annotationContextMenu",
					label: "x",
					icon,
					onCommand() {},
				});
				// javascript: is unsafe regardless of origin
				assert.isFalse(register("javascript:alert(1)"));
				// An undeclared remote origin (no host_permissions)
				assert.isFalse(register("https://evil.example.com/i.svg"));
				// The plugin's own resource is allowed
				let id = register(ownURL("icon.svg"));
				assert.isString(id);
			});

			it("prevents a plugin from unregistering another plugin's section", function () {
				let sectionID = Zotero.ReaderManager.registerSection({
					sectionID: "owned",
					pluginID: UNPRIV_ID,
					target: "textSelectionPopup",
					src: "popup.html",
				});
				assert.isFalse(Zotero.ReaderManager.unregisterSection(sectionID, "someone-else@zotero.org"));
				assert.isTrue(Zotero.ReaderManager.unregisterSection(sectionID, UNPRIV_ID));
			});
		});
	});

	describe("Window resource manager", function () {
		let pluginID = "test-plugin@zotero.org";

		afterEach(function () {
			// Clean up any registered resources
			for (let option of Zotero.WindowResourceManager._manager.options) {
				Zotero.WindowResourceManager.unregisterResource(option.resourceID);
			}
		});

		it("should register and unregister FTL resource", async function () {
			// preferences.ftl is not loaded by default in the main window
			let resourceID = Zotero.WindowResourceManager.registerResource({
				resourceID: "test-ftl",
				pluginID,
				target: "mainWindow",
				type: "ftl",
				url: "preferences.ftl",
			});
			assert.isString(resourceID);

			// Verify the FTL strings are actually resolvable
			let l10n = new Localization(["preferences.ftl"], true);
			let expected = l10n.formatValueSync("preferences-file-renaming-title");
			let value = await doc.l10n.formatValue("preferences-file-renaming-title");
			assert.isString(value);
			assert.equal(value, expected);

			// Unregister and verify the FTL link is removed
			let success = Zotero.WindowResourceManager.unregisterResource(resourceID);
			assert.isTrue(success);

			let link = doc.querySelector(`link[href="preferences.ftl"]`);
			assert.notExists(link, "FTL link should be removed after unregister");
		});
	});

	describe("PluginInteropManager", function () {
		var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");

		const PROVIDER_ID = "test-interop-provider@zotero.org";
		const CONSUMER_ID = "test-interop-consumer@zotero.org";
		const PROVIDER_GUID = "{00000000-0000-0000-0000-000000000011}";
		const CONSUMER_GUID = "{00000000-0000-0000-0000-000000000012}";

		var providerScope, consumerScope;

		function createMockAddon(id, syncGUID, { permissions = ["default", "pluginInterop"], interop_permissions = [] } = {}) {
			return createMockPlugin({
				id,
				name: "Test Plugin " + id,
				syncGUID,
				permissions,
				interopPermissions: interop_permissions,
			});
		}

		function loadScopes({ consumerInterop } = {}) {
			let provider = createMockAddon(PROVIDER_ID, PROVIDER_GUID);
			let consumer = createMockAddon(CONSUMER_ID, CONSUMER_GUID, { interop_permissions: consumerInterop || [PROVIDER_ID] });
			PluginSandbox.loadScope(provider);
			PluginSandbox.loadScope(consumer);
			providerScope = PluginSandbox.getScope(PROVIDER_ID);
			consumerScope = PluginSandbox.getScope(CONSUMER_ID);
		}

		function evalInProvider(code) {
			return Cu.evalInSandbox(code, providerScope);
		}

		function evalInConsumer(code) {
			return Cu.evalInSandbox(code, consumerScope);
		}

		beforeEach(function () {
			loadScopes();
		});

		afterEach(function () {
			// Clean up all registered commands
			for (let opt of Zotero.PluginInteropManager._registry.options) {
				Zotero.PluginInteropManager.unregister(
					Zotero.PluginInteropManager._registry._getOptionMainKey(opt)
				);
			}
			try {
				PluginSandbox.unloadScope(PROVIDER_ID);
			}
			catch {}
			try {
				PluginSandbox.unloadScope(CONSUMER_ID);
			}
			catch {}
		});

		it("should register from sandbox and call with primitive data", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "echo",
					commandVersion: "1.0.0",
					command({ data }) {
						return data;
					},
				});
			`);

			let result = evalInConsumer(`
				var echo = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "echo",
				});
				[typeof echo, echo("hello"), echo(42), echo(true)];
			`);
			assert.equal(result[0], "function");
			assert.equal(result[1], "hello");
			assert.equal(result[2], 42);
			assert.equal(result[3], true);
		});

		it("should pass callerPluginID to the command", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "whoami",
					commandVersion: "1.0.0",
					command({ callerPluginID }) {
						return callerPluginID;
					},
				});
			`);

			let result = evalInConsumer(`
				var whoami = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "whoami",
				});
				whoami();
			`);
			assert.equal(result, CONSUMER_ID);
		});

		it("should handle plain object data and return", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "transform",
					commandVersion: "1.0.0",
					command({ data }) {
						return { result: data.a + data.b, items: [data.a, data.b] };
					},
				});
			`);

			let result = evalInConsumer(`
				var transform = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "transform",
				});
				var r = transform({ a: 1, b: 2 });
				JSON.stringify(r);
			`);
			assert.deepEqual(JSON.parse(result), { result: 3, items: [1, 2] });
		});

		it("should handle async command returning a promise", async function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "asyncAdd",
					commandVersion: "1.0.0",
					command({ data }) {
						return Promise.resolve(data.a + data.b);
					},
				});
			`);

			let result = await evalInConsumer(`
				var asyncAdd = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "asyncAdd",
				});
				asyncAdd({ a: 10, b: 20 });
			`);
			assert.equal(result, 30);
		});

		it("should propagate errors thrown by the command", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "failing",
					commandVersion: "1.0.0",
					command() {
						throw new Error("intentional error");
					},
				});
			`);

			assert.throws(() => {
				evalInConsumer(`
					var failing = Zotero.PluginInteropManager.getCommand({
						callerPluginID: "${CONSUMER_ID}",
						targetPluginID: "${PROVIDER_ID}",
						commandName: "failing",
					});
					failing();
				`);
			});
		});

		it("should return NOT_FOUND for unregistered command", function () {
			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "nonexistent",
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.NOT_FOUND);
		});

		it("should return VERSION_TOO_LOW when minVersion exceeds command version", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "versioned",
					commandVersion: "1.0.0",
					command() {
						return true;
					},
				});
			`);

			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "versioned",
					minVersion: "2.0.0",
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.VERSION_TOO_LOW);
		});

		it("should return VERSION_TOO_HIGH when maxVersion is below command version", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "versioned",
					commandVersion: "3.0.0",
					command() {
						return true;
					},
				});
			`);

			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "versioned",
					maxVersion: "2.0.0",
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.VERSION_TOO_HIGH);
		});

		it("should return OK for checkOnly when command is available", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "check",
					commandVersion: "1.0.0",
					command() {
						return true;
					},
				});
			`);

			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					targetPluginID: "${PROVIDER_ID}",
					commandName: "check",
					checkOnly: true,
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.OK);
		});

		it("should succeed when version is within min/max range", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "ranged",
					commandVersion: "1.5.0",
					command({ data }) {
						return data;
					},
				});
			`);

			let result = evalInConsumer(`
				var cmd = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "ranged",
					minVersion: "1.0.0",
					maxVersion: "2.0.0",
				});
				[typeof cmd, cmd("ok")];
			`);
			assert.equal(result[0], "function");
			assert.equal(result[1], "ok");
		});

		it("should unregister a command", function () {
			evalInProvider(`
				var _regKey = Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "removable",
					commandVersion: "1.0.0",
					command() {
						return true;
					},
				});
			`);

			let key = evalInProvider("_regKey");
			assert.isString(key);

			let success = Zotero.PluginInteropManager.unregister(key);
			assert.isTrue(success);

			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "removable",
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.NOT_FOUND);
		});

		it("should throw when calling an unregistered command via stale reference", function () {
			evalInProvider(`
				var _staleKey = Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "stale",
					commandVersion: "1.0.0",
					command() {
						return "alive";
					},
				});
			`);

			evalInConsumer(`
				var _staleCmd = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "stale",
				});
			`);
			assert.equal(evalInConsumer("typeof _staleCmd"), "function");
			assert.equal(evalInConsumer("_staleCmd()"), "alive");

			let key = evalInProvider("_staleKey");
			Zotero.PluginInteropManager.unregister(key);

			// Stale reference should throw
			assert.throws(() => {
				evalInConsumer("_staleCmd()");
			});
		});

		it("should call a command from the privileged side without callerPluginID", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "privTest",
					commandVersion: "1.0.0",
					command({ callerPluginID, data }) {
						return { caller: callerPluginID, value: data };
					},
				});
			`);

			// Call directly from privileged chrome scope (no callerPluginID)
			let cmd = Zotero.PluginInteropManager.getCommand({
				targetPluginID: PROVIDER_ID,
				commandName: "privTest",
			});
			assert.isFunction(cmd);
			let result = cmd("hello");
			assert.equal(result.value, "hello");
			assert.isUndefined(result.caller);
		});

		it("should handle async return from privileged caller", async function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "privAsync",
					commandVersion: "1.0.0",
					command({ data }) {
						return Promise.resolve(data * 2);
					},
				});
			`);

			let cmd = Zotero.PluginInteropManager.getCommand({
				targetPluginID: PROVIDER_ID,
				commandName: "privAsync",
			});
			let result = await cmd(21);
			assert.equal(result, 42);
		});

		it("should propagate errors to privileged caller", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "privFail",
					commandVersion: "1.0.0",
					command() {
						throw new Error("priv error");
					},
				});
			`);

			let cmd = Zotero.PluginInteropManager.getCommand({
				targetPluginID: PROVIDER_ID,
				commandName: "privFail",
			});
			assert.throws(() => cmd(), /priv error/);
		});

		it("should expose status codes to the sandbox", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "versioned",
					commandVersion: "1.0.0",
					command() {
						return "called";
					},
				});
			`);

			// A plugin branches on the same codes the privileged side sees
			let result = evalInConsumer(`
				(() => {
					let codes = Zotero.PluginInteropManager.statusCodes;
					let lookup = options => Zotero.PluginInteropManager.getCommand(
						Object.assign({ targetPluginID: "${PROVIDER_ID}" }, options)
					);
					return {
						ok: codes.OK,
						missingMatches: lookup({ commandName: "nope" }) === codes.NOT_FOUND,
						tooLowMatches: lookup({ commandName: "versioned", minVersion: "2.0.0" })
							=== codes.VERSION_TOO_LOW,
						callable: typeof lookup({ commandName: "versioned" }),
					};
				})()
			`);
			assert.equal(result.ok, Zotero.PluginInteropManager.statusCodes.OK);
			assert.isTrue(result.missingMatches);
			assert.isTrue(result.tooLowMatches);
			assert.equal(result.callable, "function");
		});

		it("should return PERMISSION_DENIED when caller lacks interop_permissions", function () {
			// Reload scopes with consumer having no interop_permissions
			PluginSandbox.unloadScope(PROVIDER_ID);
			PluginSandbox.unloadScope(CONSUMER_ID);
			loadScopes({ consumerInterop: [] });

			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "secret",
					commandVersion: "1.0.0",
					command() {
						return "should not reach";
					},
				});
			`);

			let result = evalInConsumer(`
				Zotero.PluginInteropManager.getCommand({
					callerPluginID: "${CONSUMER_ID}",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "secret",
				});
			`);
			assert.equal(result, Zotero.PluginInteropManager.statusCodes.PERMISSION_DENIED);
		});

		it("should prevent unprivileged plugin from spoofing callerPluginID", function () {
			evalInProvider(`
				Zotero.PluginInteropManager.register({
					pluginID: "${PROVIDER_ID}",
					commandName: "whoami",
					commandVersion: "1.0.0",
					command({ callerPluginID }) {
						return callerPluginID;
					},
				});
			`);

			// Consumer tries to spoof a different callerPluginID
			let result = evalInConsumer(`
				var cmd = Zotero.PluginInteropManager.getCommand({
					callerPluginID: "spoofed-id@evil.com",
					targetPluginID: "${PROVIDER_ID}",
					commandName: "whoami",
				});
				cmd();
			`);
			// CustomParserCallable forces the real addon ID
			assert.equal(result, CONSUMER_ID);
		});
	});

	describe("ServerEndpointManager", function () {
		var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");
		var { PluginUUID } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/uuid.mjs");

		const PLUGIN_ID = "test-server-endpoint@zotero.org";
		const OTHER_ID = "test-server-endpoint-other@zotero.org";
		const PLUGIN_GUID = "{00000000-0000-0000-0000-000000000021}";
		const OTHER_GUID = "{00000000-0000-0000-0000-000000000022}";

		var pluginScope, otherScope, serverPath, pluginPathPrefix;

		function loadPluginScope(id, syncGUID) {
			let addon = createMockPlugin({
				id,
				name: "Test Plugin " + id,
				syncGUID,
				permissions: ["default", "serverEndpoint"],
			});
			PluginSandbox.loadScope(addon);
			return PluginSandbox.getScope(id);
		}

		function evalInPlugin(code) {
			return Cu.evalInSandbox(code, pluginScope);
		}

		function request(method, path, options = {}) {
			return Zotero.HTTP.request(method, serverPath + path, {
				headers: Object.assign(
					{ "Zotero-Allowed-Request": "1" },
					options.headers || {}
				),
				responseType: "text",
				successCodes: false,
				body: options.body,
			});
		}

		before(function () {
			serverPath = "http://127.0.0.1:" + Zotero.Server.port;
			pluginPathPrefix = "/plugins/" + PluginUUID.getByID(PLUGIN_ID);
		});

		beforeEach(function () {
			pluginScope = loadPluginScope(PLUGIN_ID, PLUGIN_GUID);
		});

		afterEach(function () {
			// Clean up all registered endpoints
			for (let opt of Zotero.ServerEndpointManager._manager.options) {
				Zotero.ServerEndpointManager.unregisterEndpoint(
					Zotero.ServerEndpointManager._manager._getOptionMainKey(opt)
				);
			}
			try {
				PluginSandbox.unloadScope(PLUGIN_ID);
			}
			catch {}
			try {
				PluginSandbox.unloadScope(OTHER_ID);
			}
			catch {}
		});

		it("should serve a GET request with a handler registered from the sandbox", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/hello",
					supportedMethods: ["GET"],
					handler: (request) => [200, "text/plain", "hello " + request.searchParams.name],
				});
			`);
			assert.equal(key, pluginPathPrefix + "/hello");

			let req = await request("GET", key + "?name=world");
			assert.equal(req.status, 200);
			assert.equal(req.getResponseHeader("Content-Type"), "text/plain");
			assert.equal(req.responseText, "hello world");
		});

		it("should pass parsed JSON data to an async handler on POST", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/echo",
					supportedMethods: ["POST"],
					supportedDataTypes: ["application/json"],
					handler: async (request) => {
						return [201, "application/json", JSON.stringify({
							method: request.method,
							foo: request.data.foo,
						})];
					},
				});
			`);

			let req = await request("POST", key, {
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ foo: "bar" }),
			});
			assert.equal(req.status, 201);
			assert.deepEqual(JSON.parse(req.responseText), { method: "POST", foo: "bar" });
		});

		it("should support a status-only integer response", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/no-content",
					handler: () => 204,
				});
			`);

			let req = await request("GET", key);
			assert.equal(req.status, 204);
		});

		it("should pass path template parameters to the handler", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/items/:key",
					handler: request => [200, "text/plain", request.pathParams.key],
				});
			`);
			assert.equal(key, pluginPathPrefix + "/items/:key");

			let req = await request("GET", pluginPathPrefix + "/items/ABCD2345");
			assert.equal(req.status, 200);
			assert.equal(req.responseText, "ABCD2345");
		});

		it("should return 500 if the handler throws", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/throws",
					handler: () => {
						throw new Error("boom");
					},
				});
			`);

			let req = await request("GET", key);
			assert.equal(req.status, 500);
		});

		it("should return 500 on an invalid response shape", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/invalid",
					handler: () => ({ body: "not a valid response" }),
				});
			`);

			let req = await request("GET", key);
			assert.equal(req.status, 500);
		});

		it("should reject unsupported methods", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/post-only",
					supportedMethods: ["POST"],
					handler: () => 204,
				});
			`);

			let req = await request("GET", key);
			assert.equal(req.status, 400);
		});

		it("should return 404 after unregistering", async function () {
			let key = evalInPlugin(`
				var key = Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/transient",
					handler: () => 204,
				});
				key;
			`);

			let req = await request("GET", key);
			assert.equal(req.status, 204);

			let success = evalInPlugin(`Zotero.ServerEndpointManager.unregisterEndpoint(key);`);
			assert.isTrue(success);
			assert.notProperty(Zotero.Server.Endpoints, key);

			req = await request("GET", key);
			assert.equal(req.status, 404);
		});

		it("should reject invalid paths", function () {
			let results = evalInPlugin(`
				[
					// Missing leading slash
					Zotero.ServerEndpointManager.registerEndpoint({
						pluginID: "${PLUGIN_ID}",
						path: "hello",
						handler: () => 204,
					}),
					// Path traversal
					Zotero.ServerEndpointManager.registerEndpoint({
						pluginID: "${PLUGIN_ID}",
						path: "/../connector/ping",
						handler: () => 204,
					}),
					// Empty segment
					Zotero.ServerEndpointManager.registerEndpoint({
						pluginID: "${PLUGIN_ID}",
						path: "//hello",
						handler: () => 204,
					}),
				];
			`);
			assert.isFalse(results[0]);
			assert.isFalse(results[1]);
			assert.isFalse(results[2]);
		});

		it("should reject a duplicate path from the same plugin", function () {
			let results = evalInPlugin(`
				[
					Zotero.ServerEndpointManager.registerEndpoint({
						pluginID: "${PLUGIN_ID}",
						path: "/dupe",
						handler: () => 204,
					}),
					Zotero.ServerEndpointManager.registerEndpoint({
						pluginID: "${PLUGIN_ID}",
						path: "/dupe",
						handler: () => 200,
					}),
				];
			`);
			assert.equal(results[0], pluginPathPrefix + "/dupe");
			assert.isFalse(results[1]);
		});

		it("should prevent unprivileged plugin from registering in another plugin's namespace", function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${OTHER_ID}",
					path: "/spoof",
					handler: () => 204,
				});
			`);
			// CustomParserCallable forces the real addon ID
			assert.equal(key, pluginPathPrefix + "/spoof");
		});

		it("should prevent unprivileged plugin from unregistering another plugin's endpoint", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/protected",
					handler: () => 204,
				});
			`);

			otherScope = loadPluginScope(OTHER_ID, OTHER_GUID);
			let success = Cu.evalInSandbox(
				`Zotero.ServerEndpointManager.unregisterEndpoint("${key}");`,
				otherScope
			);
			assert.isFalse(success);

			let req = await request("GET", key);
			assert.equal(req.status, 204);
		});

		it("should return the endpoint URL for a registered endpoint only", function () {
			let result = evalInPlugin(`
				var key = Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/url",
					handler: () => 204,
				});
				[
					Zotero.ServerEndpointManager.getEndpointURL(key),
					Zotero.ServerEndpointManager.getEndpointURL("${pluginPathPrefix}/unknown"),
				];
			`);
			assert.equal(result[0], serverPath + pluginPathPrefix + "/url");
			assert.isNull(result[1]);
		});

		it("should reject requests that look like unsafe web content by default", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/guarded",
					handler: () => 204,
				});
			`);

			// Without Zotero-Allowed-Request, a Mozilla/ user agent gets its
			// connection cancelled without a response
			let e = await getPromiseError(Zotero.HTTP.request("GET", serverPath + key, {
				responseType: "text",
			}));
			assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
			assert.equal(e.status, 0);
		});

		it("should not expose ServerEndpointManager without the serverEndpoint permission", function () {
			let addon = createMockPlugin({
				id: OTHER_ID,
				name: "Test Plugin " + OTHER_ID,
				syncGUID: OTHER_GUID,
				permissions: ["default"],
			});
			PluginSandbox.loadScope(addon);
			otherScope = PluginSandbox.getScope(OTHER_ID);
			let result = Cu.evalInSandbox(
				`typeof Zotero.ServerEndpointManager;`,
				otherScope
			);
			assert.equal(result, "undefined");
		});

		it("should list registered endpoints with plugin-provided info at /plugins", async function () {
			evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/with-info",
					supportedMethods: ["GET"],
					supportedDataTypes: ["application/json"],
					info: {
						description: "Test API",
						version: "1.2.0",
						params: { name: "string" },
					},
					handler: () => 204,
				});
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/without-info",
					handler: () => 204,
				});
			`);

			let req = await request("GET", "/plugins");
			assert.equal(req.status, 200);
			assert.equal(req.getResponseHeader("Content-Type"), "application/json");
			let { endpoints } = JSON.parse(req.responseText);
			let withInfo = endpoints.find(e => e.path == pluginPathPrefix + "/with-info");
			let withoutInfo = endpoints.find(e => e.path == pluginPathPrefix + "/without-info");
			assert.ok(withInfo);
			assert.equal(withInfo.pluginID, PLUGIN_ID);
			assert.deepEqual(withInfo.supportedMethods, ["GET"]);
			assert.deepEqual(withInfo.supportedDataTypes, ["application/json"]);
			assert.deepEqual(withInfo.info, {
				description: "Test API",
				version: "1.2.0",
				params: { name: "string" },
			});
			assert.ok(withoutInfo);
			assert.deepEqual(withoutInfo.supportedMethods, ["GET", "POST"]);
			assert.notProperty(withoutInfo, "supportedDataTypes");
			assert.notProperty(withoutInfo, "info");

			// Unregistered endpoints disappear from the list
			Zotero.ServerEndpointManager.unregisterEndpoint(pluginPathPrefix + "/with-info");
			req = await request("GET", "/plugins");
			let remaining = JSON.parse(req.responseText).endpoints;
			assert.notOk(remaining.find(e => e.path == pluginPathPrefix + "/with-info"));
			assert.ok(remaining.find(e => e.path == pluginPathPrefix + "/without-info"));
		});

		it("should serve an empty endpoint list when none are registered", async function () {
			let req = await request("GET", "/plugins");
			assert.equal(req.status, 200);
			assert.deepEqual(JSON.parse(req.responseText), { endpoints: [] });
		});

		it("should reject non-JSON-serializable info", function () {
			let result = evalInPlugin(`
				var cyclic = {};
				cyclic.self = cyclic;
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/cyclic-info",
					info: cyclic,
					handler: () => 204,
				});
			`);
			assert.isFalse(result);
		});

		it("should unregister endpoints when the plugin shuts down", async function () {
			let key = evalInPlugin(`
				Zotero.ServerEndpointManager.registerEndpoint({
					pluginID: "${PLUGIN_ID}",
					path: "/shutdown",
					handler: () => 204,
				});
			`);
			assert.property(Zotero.Server.Endpoints, key);

			await Zotero.ServerEndpointManager._manager._unregisterByPluginID(PLUGIN_ID);
			assert.notProperty(Zotero.Server.Endpoints, key);

			let req = await request("GET", key);
			assert.equal(req.status, 404);
		});
	});

	describe("Plugin window menus", function () {
		const CONTEXT_TARGET = "pluginWindow/shared/context";
		const FILE_TARGET = "pluginWindow/shared/menubar/file";
		const OWNER = "plugin-window-owner@zotero.org";
		const OTHER = "plugin-window-other@zotero.org";
		var menuIDs = [];
		var pluginWindow;

		before(async function () {
			// Two plugins picked the same window name; the window belongs to OWNER
			for (let [pluginID, target, l10nID] of [
				[OWNER, CONTEXT_TARGET, "owner-context"],
				[OTHER, CONTEXT_TARGET, "other-context"],
				[OTHER, FILE_TARGET, "other-file"],
			]) {
				menuIDs.push(Zotero.MenuManager.registerMenu({
					menuID: l10nID,
					pluginID,
					target,
					menus: [{ menuType: "menuitem", l10nID }],
				}));
			}
			pluginWindow = Services.ww.openWindow(
				null, "chrome://zotero/content/pluginWindow.xhtml", null,
				"chrome,dialog=no,resizable,width=300,height=200", { notitle: false }
			);
			await new Promise(resolve => pluginWindow.addEventListener("load", resolve, { once: true }));
			pluginWindow.PluginWindow.init("shared", OWNER);
		});

		after(function () {
			pluginWindow.close();
			for (let id of menuIDs) {
				Zotero.MenuManager.unregisterMenu(id);
			}
		});

		it("should scope a target's menus to the owning plugin", function () {
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET), "unscoped lookup sees every plugin");
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, OWNER));
			assert.isTrue(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, OTHER));
			assert.isFalse(Zotero.MenuManager.hasMenus(CONTEXT_TARGET, "nobody@zotero.org"));
			assert.isFalse(Zotero.MenuManager.hasMenus(FILE_TARGET, OWNER));
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

	describe("Window Controller", function () {
		const { ControllerAPIBase } = ChromeUtils.importESModule(
			"chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs"
		);
		const ControllerErrorCode = ControllerAPIBase.errorCodes;
		const { ControllerError } = ChromeUtils.importESModule(
			"chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs"
		);
		const { getWindow, getMainWindow } = ChromeUtils.importESModule(
			"chrome://zotero/content/xpcom/plugins/window.mjs"
		).WindowUtils;
		const { PluginSandbox } = ChromeUtils.importESModule(
			"chrome://zotero/content/xpcom/plugins/sandbox.mjs"
		);
		const UNPRIV_ID = "window-controller-unpriv@zotero.org";

		class TestController extends ControllerAPIBase {
			constructor() {
				super();
				this.config = {
					apiName: "TestController",
					queries: {
						echo: {
							params: { value: { type: "any", optional: true } },
							handler: params => ({ params }),
						},
						gated: {
							permissions: ["dataRead"],
							handler: () => ({ ok: true }),
						},
						leaky: {
							handler: () => ({ big: BigInt(1) }),
						},
						boom: {
							handler: () => {
								throw new TypeError("kaboom");
							},
						},
						gone: {
							handler: () => {
								throw new ControllerError(ControllerErrorCode.NOT_FOUND, "gone");
							},
						},
						whoami: {
							handler(_params, { kind, name }) {
								return { apiName: this._config.apiName, kind, name };
							},
						},
					},
					commands: {
						noop: {
							handler: () => undefined,
						},
					},
				};
			}
		}

		// A failed response's code, checking the rest of the envelope on the way
		async function failureCode(promise) {
			let { success, result, error } = await promise;
			assert.isFalse(success, "expected a failed response");
			assert.deepEqual(result, {}, "a failed response carries an empty result");
			assert.isString(error.message);
			return error.code;
		}

		describe("ControllerAPIBase", function () {
			let api;

			before(function () {
				api = new TestController();
			});

			afterEach(function () {
				try {
					PluginSandbox.unloadScope(UNPRIV_ID);
				}
				catch {}
			});

			it("should list defined requests", function () {
				assert.sameMembers(api.requestNames.queries, ["echo", "gated", "leaky", "boom", "gone", "whoami"]);
				assert.sameMembers(api.requestNames.commands, ["noop"]);
			});

			it("should reject a request without a handler or with a taken name", function () {
				assert.throws(() => {
					api.config = { queries: { broken: {} } };
				}, /has no handler/);
				assert.throws(() => {
					api.config = { commands: { noop: { handler: () => ({}) } } };
				}, /already defined/);
			});

			it("should call the handler with the controller as this and the request in context", async function () {
				assert.deepEqual(
					await api.query("whoami"),
					{ success: true, result: { apiName: "TestController", kind: "query", name: "whoami" } }
				);
			});

			it("should resolve a failure as a response, never a rejection", async function () {
				// A ControllerError carries its code; any other exception is an internal error
				assert.deepEqual(await api.query("gone"), {
					success: false,
					result: {},
					error: { code: ControllerErrorCode.NOT_FOUND, message: "gone" },
				});
				assert.deepEqual(await api.query("boom"), {
					success: false,
					result: {},
					error: { code: ControllerErrorCode.INTERNAL_ERROR, message: "kaboom" },
				});
				assert.notProperty(await api.query("whoami"), "error");
			});

			it("should fail an unknown request", async function () {
				assert.equal(await failureCode(api.query("nope")), ControllerErrorCode.UNKNOWN_REQUEST);
				assert.equal(await failureCode(api.command("echo")), ControllerErrorCode.UNKNOWN_REQUEST);
			});

			it("should fail non-object and unknown params, naming the problem", async function () {
				assert.equal(await failureCode(api.query("echo", 5)), ControllerErrorCode.INVALID_PARAMS);
				assert.equal(await failureCode(api.query("echo", { nope: 1 })), ControllerErrorCode.INVALID_PARAMS);
				let { error } = await api.query("echo", 5);
				assert.include(error.message, "must be an object");
				({ error } = await api.query("echo", { nope: 1 }));
				assert.include(error.message, "Unknown param 'nope'");
			});

			it("should hand the handler a detached plain copy of the params", async function () {
				let params = { value: { list: [1, 2] } };
				let { result: { params: received } } = await api.query("echo", params);
				assert.deepEqual(received, params);
				assert.notStrictEqual(received.value, params.value);
			});

			it("should resolve an undefined result to an empty object", async function () {
				assert.deepEqual(await api.command("noop"), { success: true, result: {} });
			});

			it("should fail a result that is not JSON-serializable", async function () {
				assert.equal(await failureCode(api.query("leaky")), ControllerErrorCode.INVALID_RESULT);
			});

			it("should bypass permission gates for chrome callers", async function () {
				assert.deepEqual(await api.query("gated"), { success: true, result: { ok: true } });
			});

			it("should gate requests on the caller plugin's permissions", async function () {
				PluginSandbox.loadScope(createMockPlugin({ id: UNPRIV_ID, permissions: ["default"] }));
				assert.equal(
					await failureCode(api.query("gated", {}, UNPRIV_ID)),
					ControllerErrorCode.PERMISSION_DENIED
				);
				PluginSandbox.unloadScope(UNPRIV_ID);

				PluginSandbox.loadScope(createMockPlugin({ id: UNPRIV_ID, permissions: ["default", "dataRead"] }));
				assert.deepEqual(await api.query("gated", {}, UNPRIV_ID), { success: true, result: { ok: true } });
			});

			it("should hand an unprivileged caller's params its pluginID and fail a supplied one", async function () {
				let { result: { params } } = await api.query("echo", { value: 1 });
				assert.notProperty(params, "pluginID", "chrome callers have no pluginID");
				assert.equal(await failureCode(api.query("echo", { pluginID: "x" })), ControllerErrorCode.INVALID_PARAMS);

				PluginSandbox.loadScope(createMockPlugin({ id: UNPRIV_ID, permissions: ["default"] }));
				({ result: { params } } = await api.query("echo", { value: 1 }, UNPRIV_ID));
				assert.deepEqual(params, { value: 1, pluginID: UNPRIV_ID });
				assert.equal(
					await failureCode(api.query("echo", { pluginID: "x" }, UNPRIV_ID)),
					ControllerErrorCode.INVALID_PARAMS
				);
			});
		});

		describe("Zotero.WindowController", function () {
			it("should list the main window with a resolvable window ID", async function () {
				let { result: { windows } } = await Zotero.WindowController.query("windows", { type: "mainWindow" });
				let info = windows.find(w => w.windowID === win.browsingContext.id);
				assert.ok(info, "test window not listed");
				assert.isNumber(info.windowID);
				assert.equal(info.type, "mainWindow");
				assert.equal(info.title, win.document.title);
				assert.isBoolean(info.focused);
				assert.strictEqual(getWindow(info.windowID, "mainWindow"), win);
			});

			it("should reject an unknown or mistyped window ID", function () {
				let e = assert.throws(() => getWindow(-1), /No window with ID/);
				assert.instanceOf(e, ControllerError);
				assert.equal(e.code, ControllerErrorCode.NOT_FOUND);
				e = assert.throws(() => getWindow(win.browsingContext.id, "readerWindow"), /is not a readerWindow/);
				assert.equal(e.code, ControllerErrorCode.NOT_FOUND);
				assert.throws(() => getMainWindow(-1), /No window with ID/);
				assert.strictEqual(getMainWindow(win.browsingContext.id), win);
			});

			it("should list every window type when no type is given", async function () {
				let { result: { windows } } = await Zotero.WindowController.query("windows");
				assert.isTrue(windows.some(w => w.type === "mainWindow"));
				assert.isTrue(windows.every(w => Zotero.WindowController.windowTypes.includes(w.type)));
			});

			it("should fail an unknown window type", async function () {
				assert.equal(await failureCode(Zotero.WindowController.query("windows", { type: "popup" })), Zotero.WindowController.errorCodes.INVALID_PARAMS);
			});

			it("should refuse to open a plugin window for a chrome caller", async function () {
				assert.equal(await failureCode(Zotero.WindowController.command("openPluginWindow", { url: "page.html" })), Zotero.WindowController.errorCodes.NOT_ALLOWED);
			});

			it("should list plugin windows with their owner and hide them from other plugins", async function () {
				const OWNER = "window-owner@zotero.org";
				let pluginWin = Services.ww.openWindow(
					null, "chrome://zotero/content/pluginWindow.xhtml", null,
					"chrome,dialog=no,resizable,width=300,height=200", { notitle: false }
				);
				await new Promise(resolve => pluginWin.addEventListener("load", resolve, { once: true }));
				pluginWin.PluginWindow.init("owned", OWNER);
				let windowID = pluginWin.browsingContext.id;
				try {
					// Chrome sees every plugin window, with its owner
					let { result: { windows } } = await Zotero.WindowController.query("windows", { type: "pluginWindow" });
					let info = windows.find(w => w.windowID === windowID);
					assert.ok(info, "plugin window not listed");
					assert.equal(info.type, "pluginWindow");
					assert.equal(info.pluginID, OWNER);
					assert.strictEqual(getWindow(windowID, "pluginWindow"), pluginWin);

					// The owner reaches it; another plugin gets NotFound, as for an unknown ID
					assert.strictEqual(getWindow(windowID, undefined, OWNER), pluginWin);
					let e = assert.throws(() => getWindow(windowID, undefined, "other@zotero.org"), /No window with ID/);
					assert.equal(e.code, ControllerErrorCode.NOT_FOUND);
					// Ownership only applies to plugin windows
					assert.strictEqual(getWindow(win.browsingContext.id, "mainWindow", "other@zotero.org"), win);

					// Through the controller, an unprivileged caller neither lists nor reaches it
					PluginSandbox.loadScope(createMockPlugin({ id: UNPRIV_ID, permissions: ["default", "window"] }));
					({ result: { windows } } = await Zotero.WindowController.query("windows", { type: "pluginWindow" }, UNPRIV_ID));
					assert.isFalse(windows.some(w => w.windowID === windowID), "another plugin's window listed");
					assert.equal(await failureCode(Zotero.WindowController.query("getWindowState", { windowID }, UNPRIV_ID)), ControllerErrorCode.NOT_FOUND);
					assert.equal(await failureCode(Zotero.WindowController.command("focusWindow", { windowID }, UNPRIV_ID)), ControllerErrorCode.NOT_FOUND);

					// closeWindow follows the same ownership rule
					assert.equal(await failureCode(Zotero.WindowController.command("closeWindow", { windowID }, UNPRIV_ID)), ControllerErrorCode.NOT_FOUND);
					await Zotero.WindowController.command("closeWindow", { windowID });
					for (let attempt = 0; attempt < 100 && !pluginWin.closed; attempt++) {
						await Zotero.Promise.delay(20);
					}
					assert.isTrue(pluginWin.closed, "chrome may close any plugin window");
				}
				finally {
					try {
						PluginSandbox.unloadScope(UNPRIV_ID);
					}
					catch {}
					if (!pluginWin.closed) {
						pluginWin.close();
					}
				}
			});

			it("should focus a window by ID", async function () {
				let stub = sinon.stub(win, "focus");
				try {
					let { result } = await Zotero.WindowController.command(
						"focusWindow",
						{ windowID: win.browsingContext.id }
					);
					assert.deepEqual(result, {});
					assert.isTrue(stub.calledOnce);
				}
				finally {
					stub.restore();
				}
			});

			it("should fail focusing an unknown window or without an ID", async function () {
				assert.equal(await failureCode(Zotero.WindowController.command("focusWindow", { windowID: -1 })), Zotero.WindowController.errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.WindowController.command("focusWindow")), Zotero.WindowController.errorCodes.INVALID_PARAMS);
			});

			it("should report a window's size mode, focus, position and size", async function () {
				let windowID = win.browsingContext.id;
				let { result: state } = await Zotero.WindowController.query("getWindowState", { windowID });
				assert.include(["normal", "minimized", "maximized", "fullscreen"], state.sizeMode);
				assert.isBoolean(state.focused);
				assert.deepEqual(
					[state.x, state.y, state.width, state.height],
					[win.screenX, win.screenY, win.outerWidth, win.outerHeight]
				);
				assert.sameMembers(Object.keys(state), ["sizeMode", "focused", "x", "y", "width", "height"]);
				assert.equal(await failureCode(Zotero.WindowController.query("getWindowState", { windowID: -1 })), Zotero.WindowController.errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.WindowController.query("getWindowState")), Zotero.WindowController.errorCodes.INVALID_PARAMS);
			});

			it("should toggle a main window's panes and report the new state", async function () {
				let controller = Zotero.WindowController._windowController;
				let windowID = win.browsingContext.id;
				Zotero_Tabs.select("zotero-pane");
				for (let pane of ["sidebar", "context"]) {
					let { open: before } = controller._getPaneState(win, pane);
					let { result: { open } } = await Zotero.WindowController.command("togglePane", { windowID, pane });
					assert.equal(open, !before, `${pane} toggled`);
					assert.deepEqual(controller._getPaneState(win, pane), { open }, `${pane} state`);
					({ result: { open } } = await Zotero.WindowController.command("togglePane", { windowID, pane }));
					assert.equal(open, before, `${pane} restored`);
				}
			});

			it("should report a pane's state", async function () {
				let controller = Zotero.WindowController._windowController;
				let windowID = win.browsingContext.id;
				Zotero_Tabs.select("zotero-pane");
				for (let pane of ["sidebar", "context"]) {
					let { result: state } = await Zotero.WindowController.query("getPaneState", { windowID, pane });
					assert.isBoolean(state.open, pane);
					assert.deepEqual(state, controller._getPaneState(win, pane), pane);
				}
				assert.equal(await failureCode(Zotero.WindowController.query("getPaneState", { windowID: -1, pane: "context" })), Zotero.WindowController.errorCodes.NOT_FOUND);
			});

			it("should put a pane in the given state when open is passed", async function () {
				let windowID = win.browsingContext.id;
				Zotero_Tabs.select("zotero-pane");
				for (let pane of ["sidebar", "context"]) {
					let { result: initial } = await Zotero.WindowController.query("getPaneState", { windowID, pane });
					let set = open => Zotero.WindowController.command("togglePane", { windowID, pane, open });

					let { result } = await set(true);
					assert.isTrue(result.open, `${pane} opened`);
					// Asking for the state it's already in leaves it alone
					({ result } = await set(true));
					assert.isTrue(result.open, `${pane} still open`);
					({ result } = await set(false));
					assert.isFalse(result.open, `${pane} closed`);
					({ result } = await set(false));
					assert.isFalse(result.open, `${pane} still closed`);

					await set(initial.open);
				}
			});

			it("should toggle the item pane in a library tab and the context pane in other tabs", async function () {
				let windowID = win.browsingContext.id;
				let toggle = () => Zotero.WindowController.command("togglePane", { windowID, pane: "context" });

				// Library tab: the right-hand pane is ZoteroPane's own item pane
				Zotero_Tabs.select("zotero-pane");
				let itemPaneOpen = !ZoteroPane.itemPane.collapsed;
				let contextPaneOpen = !ZoteroContextPane.collapsed;
				let { result } = await toggle();
				assert.equal(result.open, !itemPaneOpen, "item pane toggled in the library tab");
				assert.equal(!ZoteroPane.itemPane.collapsed, !itemPaneOpen);
				assert.equal(!ZoteroContextPane.collapsed, contextPaneOpen, "context pane untouched in the library tab");
				await toggle();

				// Reader tab: the right-hand pane is the shared context pane
				let attachment = await importFileAttachment("test.pdf");
				let { instance: reader } = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				try {
					itemPaneOpen = !ZoteroPane.itemPane.collapsed;
					contextPaneOpen = !ZoteroContextPane.collapsed;
					({ result } = await toggle());
					assert.equal(result.open, !contextPaneOpen, "context pane toggled in a reader tab");
					assert.equal(!ZoteroContextPane.collapsed, !contextPaneOpen);
					assert.equal(!ZoteroPane.itemPane.collapsed, itemPaneOpen, "item pane untouched in a reader tab");
					await toggle();
				}
				finally {
					Zotero_Tabs.close(reader.tabID);
					Zotero_Tabs.select("zotero-pane");
				}
			});

			it("should toggle the collections pane in a library tab and the reader's sidebar in a reader tab", async function () {
				let windowID = win.browsingContext.id;
				let toggle = () => Zotero.WindowController.command("togglePane", { windowID, pane: "sidebar" });
				let collectionsPane = doc.getElementById("zotero-collections-pane");
				let collectionsPaneOpen = () => !collectionsPane.hasAttribute("collapsed");

				// Library tab: the left pane is the collections pane
				Zotero_Tabs.select("zotero-pane");
				let open = collectionsPaneOpen();
				let { result } = await toggle();
				assert.equal(result.open, !open, "collections pane toggled");
				assert.equal(collectionsPaneOpen(), !open);
				await toggle();
				assert.equal(collectionsPaneOpen(), open, "collections pane restored");

				// Reader tab: the left pane is the reader's own sidebar, whose open
				// state Zotero_Tabs keeps per tab type
				let attachment = await importFileAttachment("test.pdf");
				let { instance: reader } = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				try {
					open = Zotero_Tabs.getSidebarState("reader").open;
					let libraryPaneOpen = collectionsPaneOpen();
					({ result } = await toggle());
					assert.equal(result.open, !open, "reader sidebar toggled");
					assert.equal(Zotero_Tabs.getSidebarState("reader").open, !open);
					assert.equal(collectionsPaneOpen(), libraryPaneOpen, "collections pane untouched");
					({ result } = await toggle());
					assert.equal(result.open, open, "reader sidebar restored");
				}
				finally {
					Zotero_Tabs.close(reader.tabID);
					Zotero_Tabs.select("zotero-pane");
				}
			});

			it("should fail toggling an unknown pane or a pane of an unknown window", async function () {
				let windowID = win.browsingContext.id;
				assert.equal(await failureCode(Zotero.WindowController.command("togglePane", { windowID, pane: "nope" })), Zotero.WindowController.errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.WindowController.command("togglePane", { windowID: -1, pane: "context" })), Zotero.WindowController.errorCodes.NOT_FOUND);
			});

			it("should open a note and a reader in their own windows and reuse an existing one", async function () {
				let note = await createDataObject("item", { itemType: "note" });
				let attachment = await importFileAttachment("test.pdf");
				let opened = [];
				try {
					let { result: { windowID } } = await Zotero.WindowController.command("openWindow", { type: "note", itemID: note.id });
					let noteWin = getWindow(windowID, "noteWindow");
					opened.push(noteWin);
					assert.equal(noteWin.name, "zotero-note-" + note.id);
					let { result: { windows: noteWindows } } = await Zotero.WindowController.query("windows", { type: "noteWindow" });
					assert.equal(noteWindows.find(w => w.windowID === windowID).itemID, note.id);
					let { result: again } = await Zotero.WindowController.command("openWindow", { type: "note", itemID: note.id });
					assert.equal(again.windowID, windowID, "an existing note window should be reused");

					({ result: { windowID } } = await Zotero.WindowController.command("openWindow", { type: "reader", itemID: attachment.id }));
					let readerWin = getWindow(windowID, "readerWindow");
					opened.push(readerWin);
					assert.equal(readerWin.reader.itemID, attachment.id);
					let { result: { windows } } = await Zotero.WindowController.query("windows", { type: "readerWindow" });
					assert.isTrue(windows.some(w => w.windowID === windowID), "the reader window should be listed");
					assert.equal(windows.find(w => w.windowID === windowID).itemID, attachment.id);
					({ result: again } = await Zotero.WindowController.command("openWindow", { type: "reader", itemID: attachment.id }));
					assert.equal(again.windowID, windowID, "an existing reader window should be reused");

					// closeWindow reaches any window type
					await Zotero.WindowController.command("closeWindow", { windowID });
					for (let attempt = 0; attempt < 100 && !readerWin.closed; attempt++) {
						await Zotero.Promise.delay(20);
					}
					assert.isTrue(readerWin.closed, "closeWindow should close a reader window");

					let errorCodes = Zotero.WindowController.errorCodes;
					assert.equal(await failureCode(Zotero.WindowController.command("openWindow", { type: "note", itemID: -1 })), errorCodes.NOT_FOUND);
					assert.equal(await failureCode(Zotero.WindowController.command("openWindow", { type: "reader", itemID: note.id })), errorCodes.INVALID_PARAMS);
					assert.equal(await failureCode(Zotero.WindowController.command("openWindow", { type: "library", itemID: note.id })), errorCodes.INVALID_PARAMS);
				}
				finally {
					for (let w of opened) {
						if (!w.closed) {
							w.close();
						}
					}
				}
			});

			it("should open the preferences on a pane, reusing an open window", async function () {
				const PANE = "zotero-prefpane-advanced";
				let errorCodes = Zotero.WindowController.errorCodes;
				// The command does not wait for the pane to show
				async function waitForPane(prefsWin, pane) {
					for (let attempt = 0; attempt < 100 && prefsWin.Zotero_Preferences?.navigation?.value !== pane; attempt++) {
						await Zotero.Promise.delay(20);
					}
					assert.equal(prefsWin.Zotero_Preferences.navigation.value, pane);
				}
				let { result: { windowID } } = await Zotero.WindowController.command("openWindow", {
					type: "preferencePane", location: { pane: PANE },
				});
				let prefsWin = getWindow(windowID, "preferencePane");
				try {
					await waitForPane(prefsWin, PANE);
					let again = await Zotero.WindowController.command("openWindow", {
						type: "preferencePane", location: { pane: "zotero-prefpane-general" },
					});
					assert.equal(again.result.windowID, windowID, "an open preferences window should be reused");
					await waitForPane(prefsWin, "zotero-prefpane-general");
					let { result: { windows } } = await Zotero.WindowController.query("windows", { type: "preferencePane" });
					assert.isTrue(windows.some(w => w.windowID === windowID), "the preferences window should be listed");

					assert.equal(await failureCode(Zotero.WindowController.command("openWindow", { type: "preferencePane", location: { pane: "nope" } })), errorCodes.NOT_FOUND);
					assert.equal(await failureCode(Zotero.WindowController.command("openWindow", { type: "note" })), errorCodes.INVALID_PARAMS);
				}
				finally {
					prefsWin.close();
				}
			});
		});

		describe("Zotero.TabController", function () {
			var windowID;
			var libraryTabID;

			before(async function () {
				windowID = win.browsingContext.id;
				await win.ZoteroPane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
				// The library tab has no exposed constant; plugins find it by type
				let { result: { tabs } } = await Zotero.TabController.query("tabs", { windowID });
				libraryTabID = tabs.find(t => t.type === "library").tabID;
				assert.equal(libraryTabID, "zotero-pane");
			});

			afterEach(function () {
				win.Zotero_Tabs.closeAll();
			});

			// Tabs report "loading" until the tab manager marks them loaded, which can be
			// after the opener resolves
			async function waitForTabState(tabID, state) {
				for (let attempt = 0; attempt < 100; attempt++) {
					let { result: { tabs } } = await Zotero.TabController.query("tabs", { windowID });
					let tab = tabs.find(t => t.tabID === tabID);
					if (tab?.state === state) {
						return tabs;
					}
					await Zotero.Promise.delay(50);
				}
				throw new Error(`Tab ${tabID} did not reach state '${state}'`);
			}

			it("should hold the tab and library-selection requests, not the window ones", function () {
				let { queries, commands } = Zotero.TabController._tabController.requestNames;
				assert.sameMembers(queries, ["tabs"]);
				assert.sameMembers(commands, ["selectTab", "closeTabs", "moveTab", "selectItems", "selectCollectionsOrLibraries", "openTab"]);
				let windowCommands = Zotero.WindowController._windowController.requestNames.commands;
				assert.sameMembers(windowCommands, ["focusWindow", "closeWindow", "togglePane", "openWindow", "openPluginWindow"]);
			});

			it("should require a window ID on every request", async function () {
				let errorCodes = Zotero.TabController.errorCodes;
				assert.equal(await failureCode(Zotero.TabController.query("tabs")), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("selectTab", { tabID: libraryTabID })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.query("tabs", { windowID: -1 })), errorCodes.NOT_FOUND);
			});

			it("should describe the library tab with its selection", async function () {
				let { result } = await Zotero.TabController.query("tabs", { windowID });
				assert.equal(result.windowID, windowID);
				assert.equal(result.selectedTabID, libraryTabID);
				let [library] = result.tabs;
				assert.equal(library.tabID, libraryTabID);
				assert.equal(library.type, "library");
				assert.equal(library.state, "loaded");
				assert.equal(library.index, 0);
				assert.isTrue(library.selected);
				assert.include(library.libraryIDs, Zotero.Libraries.userLibraryID);
				assert.isArray(library.collectionIDs);
				assert.isArray(library.itemIDs);
			});

			it("should list, select, move and close note tabs", async function () {
				let note1 = await createDataObject("item", { itemType: "note" });
				let note2 = await createDataObject("item", { itemType: "note" });
				let { instance: editor } = await Zotero.Notes.open(note1.id);
				let { tabID: tab2ID } = await Zotero.Notes.open(note2.id, null, { openInBackground: true });

				let tabs = await waitForTabState(editor.tabID, "loaded");
				let { result: { selectedTabID } } = await Zotero.TabController.query("tabs", { windowID });
				assert.equal(selectedTabID, editor.tabID);
				assert.lengthOf(tabs, 3);
				assert.isFalse(tabs[0].selected);
				let tab1 = tabs.find(t => t.tabID === editor.tabID);
				assert.equal(tab1.type, "note");
				assert.equal(tab1.state, "loaded");
				assert.deepEqual(tab1.itemIDs, [note1.id]);
				assert.equal(tab1.index, 1);
				assert.isTrue(tab1.selected);
				let tab2 = tabs.find(t => t.tabID === tab2ID);
				assert.equal(tab2.state, "unloaded");
				assert.equal(tab2.index, 2);
				assert.isFalse(tab2.selected);

				await Zotero.TabController.command("selectTab", { windowID, tabID: libraryTabID });
				assert.equal(win.Zotero_Tabs.selectedID, libraryTabID);

				await Zotero.TabController.command("moveTab", { windowID, tabID: tab2ID, index: 1 });
				({ result: { tabs } } = await Zotero.TabController.query("tabs", { windowID }));
				assert.equal(tabs[1].tabID, tab2ID);
				assert.equal(tabs[2].tabID, editor.tabID);

				await Zotero.TabController.command("closeTabs", { windowID, tabIDs: [editor.tabID, tab2ID] });
				({ result: { tabs } } = await Zotero.TabController.query("tabs", { windowID }));
				assert.lengthOf(tabs, 1);
			});

			it("should report a reader tab's subtype", async function () {
				let attachment = await importFileAttachment("test.pdf");
				let { instance: reader } = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				let tabs = await waitForTabState(reader.tabID, "loaded");
				let tab = tabs.find(t => t.tabID === reader.tabID);
				assert.equal(tab.type, "reader");
				assert.equal(tab.subType, "pdf");
				assert.deepEqual(tab.itemIDs, [attachment.id]);
				assert.isTrue(tab.selected);
			});

			it("should select items in the library tab and switch to it unless told not to", async function () {
				let item1 = await createDataObject("item");
				let item2 = await createDataObject("item");
				let note = await createDataObject("item", { itemType: "note" });
				let { instance: editor } = await Zotero.Notes.open(note.id);
				assert.equal(win.Zotero_Tabs.selectedID, editor.tabID);

				let { result } = await Zotero.TabController.command("selectItems", { windowID, itemIDs: [item1.id, item2.id] });
				assert.deepEqual(result, { selected: true });
				assert.equal(win.Zotero_Tabs.selectedID, libraryTabID);
				assert.sameMembers(win.ZoteroPane.getSelectedItems(true), [item1.id, item2.id]);

				win.Zotero_Tabs.select(editor.tabID);
				({ result } = await Zotero.TabController.command(
					"selectItems",
					{ windowID, itemIDs: [item1.id], noTabSwitch: true }
				));
				assert.deepEqual(result, { selected: true });
				assert.equal(win.Zotero_Tabs.selectedID, editor.tabID);
				assert.sameMembers(win.ZoteroPane.getSelectedItems(true, { libraryTabOnly: true }), [item1.id]);

				({ result } = await Zotero.TabController.command("selectItems", { windowID, itemIDs: [] }));
				assert.deepEqual(result, { selected: false });
			});

			it("should select collections or libraries by type and IDs", async function () {
				let collection1 = await createDataObject("collection");
				let collection2 = await createDataObject("collection");
				let { result } = await Zotero.TabController.command(
					"selectCollectionsOrLibraries",
					{ windowID, type: "collection", ids: [collection1.id] }
				);
				assert.deepEqual(result, { selected: true });
				assert.sameMembers(win.ZoteroPane.getSelectedCollections(true), [collection1.id]);

				// Several IDs use the tree's multi-selection
				({ result } = await Zotero.TabController.command(
					"selectCollectionsOrLibraries",
					{ windowID, type: "collection", ids: [collection1.id, collection2.id] }
				));
				assert.deepEqual(result, { selected: true });
				assert.sameMembers(win.ZoteroPane.getSelectedCollections(true), [collection1.id, collection2.id]);
				let { result: { tabs } } = await Zotero.TabController.query("tabs", { windowID });
				assert.sameMembers(tabs[0].collectionIDs, [collection1.id, collection2.id]);

				let libraryID = Zotero.Libraries.userLibraryID;
				({ result } = await Zotero.TabController.command(
					"selectCollectionsOrLibraries",
					{ windowID, type: "trash", ids: [libraryID] }
				));
				assert.deepEqual(result, { selected: true });
				assert.isTrue(win.ZoteroPane.getCollectionTreeRows()[0].isTrash());

				({ result } = await Zotero.TabController.command(
					"selectCollectionsOrLibraries",
					{ windowID, type: "library", ids: [libraryID] }
				));
				assert.deepEqual(result, { selected: true });
				let rows = win.ZoteroPane.getCollectionTreeRows();
				assert.lengthOf(rows, 1);
				assert.isTrue(rows[0].isLibrary());
			});

			it("should fail on unknown tabs, items and rows and protect the library tab", async function () {
				let errorCodes = Zotero.TabController.errorCodes;
				assert.equal(await failureCode(Zotero.TabController.command("selectTab", { windowID, tabID: "nope" })), errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.TabController.command("closeTabs", { windowID, tabIDs: [libraryTabID] })), errorCodes.NOT_ALLOWED);
				assert.equal(await failureCode(Zotero.TabController.command("moveTab", { windowID, tabID: libraryTabID, index: 1 })), errorCodes.NOT_ALLOWED);
				assert.equal(await failureCode(Zotero.TabController.command("moveTab", { windowID, tabID: "nope", index: 0 })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("selectItems", { windowID, itemIDs: [-1] })), errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.TabController.command("selectCollectionsOrLibraries", { windowID, type: "nope", ids: [1] })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("selectCollectionsOrLibraries", { windowID, type: "collection", ids: [999999] })), errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.TabController.command("selectCollectionsOrLibraries", { windowID, type: "collection", ids: [] })), errorCodes.INVALID_PARAMS);
				// The validator's reason reaches the caller
				let { error } = await Zotero.TabController.command("moveTab", { windowID, tabID: "nope", index: "1" });
				assert.equal(error.code, errorCodes.INVALID_PARAMS);
				assert.include(error.message, '["index"]');
			});

			it("should open notes and readers in tabs, reusing a tab unless duplicates are allowed", async function () {
				let note = await createDataObject("item", { itemType: "note" });
				let { result: { tabID } } = await Zotero.TabController.command("openTab", { windowID, type: "note", itemID: note.id });
				assert.equal(win.Zotero_Tabs.selectedID, tabID);
				let tabs = await waitForTabState(tabID, "loaded");
				let tab = tabs.find(t => t.tabID === tabID);
				assert.equal(tab.type, "note");
				assert.deepEqual(tab.itemIDs, [note.id]);

				// The same item selects the existing tab
				await Zotero.TabController.command("selectTab", { windowID, tabID: libraryTabID });
				let { result: again } = await Zotero.TabController.command("openTab", { windowID, type: "note", itemID: note.id });
				assert.equal(again.tabID, tabID);
				assert.equal(win.Zotero_Tabs.selectedID, tabID);

				// A background duplicate is a new, unselected tab at the requested index, left unloaded
				let { result: dup } = await Zotero.TabController.command("openTab", {
					windowID, type: "note", itemID: note.id, background: true, allowDuplicate: true, index: 1,
				});
				assert.notEqual(dup.tabID, tabID);
				assert.equal(win.Zotero_Tabs.selectedID, tabID);
				({ result: { tabs } } = await Zotero.TabController.query("tabs", { windowID }));
				let dupTab = tabs.find(t => t.tabID === dup.tabID);
				assert.equal(dupTab.index, 1);
				assert.equal(dupTab.state, "unloaded");

				// An existing unloaded tab for the item is loaded and reused
				let attachment = await importFileAttachment("test.pdf");
				let { id: unloadedID } = win.Zotero_Tabs.add({ type: "reader-unloaded", title: "PDF", data: { itemID: attachment.id } });
				({ result: { tabID } } = await Zotero.TabController.command("openTab", { windowID, type: "reader", itemID: attachment.id }));
				assert.equal(tabID, unloadedID);
				tabs = await waitForTabState(tabID, "loaded");
				tab = tabs.find(t => t.tabID === tabID);
				assert.equal(tab.type, "reader");
				assert.equal(tab.subType, "pdf");
				assert.isTrue(tab.selected);
			});

			it("should fail opening a missing item, an item of the wrong kind, or a bad index", async function () {
				let errorCodes = Zotero.TabController.errorCodes;
				let item = await createDataObject("item");
				let note = await createDataObject("item", { itemType: "note" });
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID, type: "note", itemID: -1 })), errorCodes.NOT_FOUND);
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID, type: "note", itemID: item.id })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID, type: "reader", itemID: item.id })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID, type: "library", itemID: note.id })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID, type: "note", itemID: note.id, index: 0 })), errorCodes.INVALID_PARAMS);
				assert.equal(await failureCode(Zotero.TabController.command("openTab", { windowID: -1, type: "note", itemID: note.id })), errorCodes.NOT_FOUND);
			});
		});
	});
});
