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
			let reader = await Zotero.Reader.open(pdfAttachment.id, undefined, {
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
			onCommand: (event, context) => {
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
			assert.equal(context.buttonElem, button);
			assert.equal(context.tabType, "library");
			assert.equal(context.tabID, "zotero-pane");
			assert.isArray(context.items);

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
				onCommand: (event, context) => {
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
			assert.equal(context.reader, reader);

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
			assert.equal(result, Zotero.PluginInteropManager.NOT_FOUND);
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
			assert.equal(result, Zotero.PluginInteropManager.VERSION_TOO_LOW);
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
			assert.equal(result, Zotero.PluginInteropManager.VERSION_TOO_HIGH);
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
			assert.equal(result, Zotero.PluginInteropManager.OK);
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
			assert.equal(result, Zotero.PluginInteropManager.NOT_FOUND);
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
			assert.equal(result, Zotero.PluginInteropManager.PERMISSION_DENIED);
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
});
