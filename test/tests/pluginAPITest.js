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
			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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
			await Zotero.Reader.getByTabID(tabID)._waitForReader();
			// Ensure context pane is open
			ZoteroContextPane.splitter.setAttribute("state", "open");
			result = await itemChangePromise;

			let itemDetails = ZoteroContextPane.context._getItemContext(tabID);
			rowElem = itemDetails.getPane("info").querySelector(`[data-custom-row-id="${rowID}"]`);
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
			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);

			assert.notExists(rowElem.previousElementSibling);
			await waitForUnregister(rowID);

			// Row after creator rows
			rowID = await waitForRegister(afterCreatorsOption);
			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);

			assert.exists(rowElem.previousElementSibling.querySelector(".creator-type-value"));
			assert.notExists(rowElem.nextElementSibling.querySelector(".creator-type-value"));
			await waitForUnregister(rowID);

			// Row at end
			rowID = rowID = await waitForRegister(endOption);
			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);

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

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.readOnly);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(editableOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.readOnly);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(notEditableOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.multiline);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(multilineOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isTrue(valueElem.multiline);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(notMultilineOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			let valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.noWrap);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(noWrapOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isTrue(valueElem.noWrap);

			await waitForUnregister(rowID);

			rowID = await waitForRegister(wrapOption);

			rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
			valueElem = rowElem.querySelector(".value");

			assert.isFalse(valueElem.noWrap);

			await waitForUnregister(rowID);
		});

		it("should refresh custom row value", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			await ZoteroPane.selectItem(item.id);
			
			let rowID = await waitForRegister(defaultOption);

			let rowElem = infoSection.querySelector(`[data-custom-row-id="${rowID}"]`);
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
				() => !!doc.querySelector(`#zotero-items-tree .virtualized-table-header .cell.${dataKey}`),
				100, 3);
		};

		let waitForUnregister = async (columnID) => {
			let unregisterPromise = waitForNotifierEvent("refresh", "itemtree");
			let success = Zotero.ItemTreeManager.unregisterColumn(columnID);
			await unregisterPromise;
			return success;
		};

		let getSelectedRowCell = (dataKey) => {
			let cell = doc.querySelector(`#zotero-items-tree .row.selected .${dataKey}`);
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
});
