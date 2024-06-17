describe("Plugin API", function () {
	var win, _doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane, _itemsView, infoSection, caches;

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
		_doc = win.document;
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

			assert.notExists(rowElem.nextElementSibling);
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
	});
});
