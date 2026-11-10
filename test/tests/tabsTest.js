describe("Zotero_Tabs", function() {
	var win, doc, zp, tabs;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		zp = win.ZoteroPane;
		tabs = win.Zotero_Tabs;
	});
	
	after(function () {
		win.close();
	});
	
	/**
	 * Leave the window with one selected library tab whose view has the base element ids
	 */
	async function resetTabs() {
		let libraryTab = tabs._tabs.find(tab => tabs.isLibraryTab(tab.id));
		// A view promoted to primary keeps its suffixed ids, so start over from a new one
		if (zp.getLibraryView(libraryTab?.id)?._idSuffix) {
			libraryTab = null;
		}
		let ids = tabs._tabs.filter(tab => tab !== libraryTab).map(tab => tab.id);
		if (ids.length) {
			tabs.close(ids, { skipWindowClose: true });
		}
		if (!libraryTab) {
			await addLibraryTab();
			return;
		}
		tabs.select(libraryTab.id);
		await waitForLibraryView(libraryTab.id);
	}
	
	/**
	 * Wait for a library tab's view to be created and to finish restoring its state
	 *
	 * @return {Promise<LibraryView>}
	 */
	async function waitForLibraryView(tabID) {
		await waitForCallback(
			() => tabs._getTab(tabID).tab?.type == 'library' && zp.getLibraryView(tabID)?.loaded,
			50,
			10
		);
		let view = zp.getLibraryView(tabID);
		await view.waitForLibraryTabState();
		return view;
	}
	
	/**
	 * Open and select a library tab showing the given state
	 */
	async function addLibraryTab(state) {
		let id = tabs.addLibraryTab({ state });
		let view = await waitForLibraryView(id);
		return { id, view };
	}
	
	function getRowIDs(view) {
		return view.getCollectionTreeRows().map(row => row.id);
	}

	describe("Title rendering", function () {
		it("should render citeproc.js markup in a tab title", async function () {
			let item = await createDataObject('item', {
				title: 'Not italic, <i>italic</i>'
			});
			let attachment = await importPDFAttachment(item);
			let reader = await Zotero.Reader.open(attachment.id);
			let tab;
			while (!tab?.textContent.includes('Not italic, italic')) {
				await Zotero.Promise.delay(10);
				tab = doc.querySelector(`#tab-bar-container .tab[data-id="${reader.tabID}"]`);
			}
			assert.include(tab.querySelector('i').textContent, 'italic');
		});
		
		it("should not render unknown markup in a tab title", async function () {
			let item = await createDataObject('item', {
				title: 'Something bad <img src="missing.jpg" onerror="alert(1)">'
			});
			let attachment = await importPDFAttachment(item);
			let reader = await Zotero.Reader.open(attachment.id);
			let tab;
			while (!tab?.textContent.includes('Something bad <img src="missing.jpg" onerror="alert(1)">')) {
				await Zotero.Promise.delay(10);
				tab = doc.querySelector(`#tab-bar-container .tab[data-id="${reader.tabID}"]`);
			}
			assert.notOk(tab.querySelector('img'));
		});
	});

	describe("#unload()", function () {
		it("should not make an unloaded tab reopenable", async function () {
			let item = await createDataObject('item');
			let attachment = await importPDFAttachment(item);
			let reader = await Zotero.Reader.open(attachment.id);
			let tabs = win.Zotero_Tabs;
			tabs.select('zotero-pane');
			let lastClosed = Zotero.Session.getLastClosed();
			
			tabs.unload(reader.tabID);
			
			let { tab } = tabs._getTab(reader.tabID);
			assert.equal(tab.type, 'reader-unloaded');
			assert.equal(Zotero.Session.getLastClosed(), lastClosed);
			tabs.close(reader.tabID);
		});
	});

	describe("Library tabs", function () {
		var collection1, collection2, item1, item2, attachment;
		
		before(async function () {
			collection1 = await createDataObject('collection', { name: 'Library Tab 1' });
			collection2 = await createDataObject('collection', { name: 'Library Tab 2' });
			item1 = await createDataObject('item', {
				title: 'Library Tab Item One',
				collections: [collection1.id]
			});
			item2 = await createDataObject('item', {
				title: 'Library Tab Item Two',
				collections: [collection2.id]
			});
			attachment = await importPDFAttachment(item1);
		});
		
		beforeEach(async function () {
			await resetTabs();
			await zp.waitForLibraryTabState();
			await selectCollection(win, collection1);
			await setQuickSearch('');
		});
		
		after(async function () {
			await resetTabs();
		});
		
		async function setQuickSearch(value) {
			zp.libraryView.getElement('zotero-tb-search').value = value;
			await zp.search();
		}
		
		it("should show different collections in two library tabs at the same time", async function () {
			let primaryView = zp.libraryView;
			let { id, view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			
			assert.notEqual(view, primaryView);
			assert.equal(zp.libraryView, view);
			assert.deepEqual(getRowIDs(view), ['C' + collection2.id]);
			assert.deepEqual(getRowIDs(primaryView), ['C' + collection1.id]);
			assert.sameMembers(view.itemsView.getSortedItems(true), [item2.id]);
			assert.sameMembers(primaryView.itemsView.getSortedItems(true), [item1.id]);
			
			// The primary view keeps the base ids, and the other view's ids are suffixed
			// with its tab id, with the label wiring following
			assert.equal(doc.getElementById('zotero-tb-add').closest('library-view'), primaryView);
			assert.equal(view.getElement('zotero-tb-add').id, 'zotero-tb-add-' + id);
			assert.equal(
				view.querySelector('label[control]').getAttribute('control'),
				view.getElement('zotero-lookup-textbox').id
			);
			
			// ZoteroPane's library view follows the selected tab
			tabs.select(primaryView.tabID);
			assert.equal(zp.libraryView, primaryView);
			assert.equal(zp.itemsView, primaryView.itemsView);
		});
		
		it("should open each selected collection in a tab of its own", async function () {
			let { collectionsView } = zp;
			await collectionsView.restoreSelection(['C' + collection1.id, 'C' + collection2.id]);
			try {
				let count = tabs._tabs.length;
				zp.openCollectionsInNewTab();
				let newTabs = tabs._tabs.slice(count);
				assert.deepEqual(
					newTabs.map(tab => tab.data.state.collections),
					[['C' + collection1.id], ['C' + collection2.id]]
				);
				assert.deepEqual(newTabs.map(tab => tab.title), [collection1.name, collection2.name]);
				assert.equal(tabs.selectedID, newTabs[0].id);
				await waitForLibraryView(newTabs[0].id);
			}
			finally {
				await collectionsView.restoreSelection(['C' + collection1.id]);
			}
		});
		
		it("should open a right-clicked unselected collection in a new tab", async function () {
			let { collectionsView } = zp;
			await collectionsView.selectByID('C' + collection1.id);
			let menu = doc.getElementById('zotero-collectionmenu');
			let rowEl = getVisibleRowElement(
				collectionsView,
				collectionsView.getRowIndexByID('C' + collection2.id)
			);
			let shown = new Promise(resolve => menu.addEventListener('popupshown', resolve, { once: true }));
			rowEl.dispatchEvent(new win.MouseEvent('contextmenu', { bubbles: true, button: 2 }));
			await shown;
			
			let count = tabs._tabs.length;
			menu.activateItem(doc.getElementById('openInNewTab'));
			await waitForCallback(() => tabs._tabs.length > count, 50, 10);
			let newTabs = tabs._tabs.slice(count);
			assert.deepEqual(newTabs.map(tab => tab.data.state.collections), [['C' + collection2.id]]);
			await waitForLibraryView(newTabs[0].id);
		});
		
		it("should restore a quick search with conditions as a search", async function () {
			let { view } = await addLibraryTab({
				collections: ['C' + collection2.id],
				quickSearch: 'type:book'
			});
			assert.equal(view.getElement('zotero-tb-search').value, 'type:book');
			assert.equal(view.itemsView.rowCount, 1);
			assert.equal(view.itemsView.getRow(0).ref.id, item2.id);
		});
		
		it("should leave a reader's menus and context pane alone when a background library tab finishes loading", async function () {
			let pdf = await importPDFAttachment(item1);
			let reader = await Zotero.Reader.open(pdf.id);
			await reader._initPromise;
			let { id } = tabs.add({
				type: 'library-unloaded',
				title: 'Background',
				data: { state: { collections: ['C' + collection2.id] } },
				select: false
			});
			tabs.select(id);
			tabs.select(reader.tabID);
			await waitForLibraryView(id);
			await Zotero.Promise.delay(100);
			
			assert.isTrue([...doc.querySelectorAll('.menu-type-library')].every(x => x.hidden));
			assert.isFalse([...doc.querySelectorAll('.menu-type-reader')].every(x => x.hidden));
			assert.isFalse(doc.getElementById('zotero-context-splitter').hasAttribute('hidden'));
		});
		
		it("should keep a background tab's view alive across a tab switch", async function () {
			let primaryView = zp.libraryView;
			await setQuickSearch('Item One');
			await zp.itemsView.selectItem(item1.id);
			// A search typed but not yet run
			let searchBox = primaryView.getElement('zotero-tb-search');
			searchBox.searchTextbox.value = 'Item One typing';
			
			let { view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			assert.equal(view.getElement('zotero-tb-search').value, '');
			
			tabs.select(primaryView.tabID);
			assert.equal(searchBox.searchTextbox.value, 'Item One typing');
			assert.sameMembers(zp.getSelectedItems(true), [item1.id]);
			assert.sameMembers(zp.itemsView.getSortedItems(true), [item1.id]);
		});
		
		it("should not update window command state from a background tab's selection", async function () {
			let primaryView = zp.libraryView;
			let { view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			await view.itemsView.selectItem(item2.id);
			tabs.select(primaryView.tabID);
			await zp.itemsView.selectItem(item1.id);
			let copyCitation = doc.getElementById('cmd_zotero_copyCitation');
			assert.isFalse(copyCitation.hasAttribute('disabled'));
			
			// Clearing the selection in the background view leaves the command enabled for
			// the visible view's selection
			view.itemsView.selection.clearSelection();
			await view.itemSelected();
			assert.isFalse(copyCitation.hasAttribute('disabled'));
			assert.sameMembers(zp.getSelectedItems(true), [item1.id]);
		});
		
		describe("Actions that wait while another tab is selected", function () {
			var viewA, tabB;
			
			beforeEach(async function () {
				viewA = zp.libraryView;
				({ id: tabB } = await addLibraryTab({ collections: ['C' + collection2.id] }));
				tabs.select(viewA.tabID);
			});
			
			/**
			 * Run an action that saves, selecting tab B while its transaction waits its turn
			 */
			async function runWhileTabBSelected(action) {
				let held = Zotero.Promise.defer();
				let transaction = Zotero.DB.executeTransaction(async () => {
					await held.promise;
				});
				let promise = action();
				tabs.select(tabB);
				held.resolve();
				await transaction;
				return promise;
			}
			
			it("should create a new item in the tab it was started from", async function () {
				let blur = Zotero.Promise.defer();
				let stub = sinon.stub(viewA.itemPane, 'handleBlur').returns(blur.promise);
				try {
					let promise = zp.newItem(Zotero.ItemTypes.getID('book'));
					tabs.select(tabB);
					blur.resolve();
					let item = await promise;
					assert.isTrue(item.inCollection(collection1.id));
					assert.equal(tabs.selectedID, viewA.tabID);
					assert.sameMembers(viewA.itemsView.getSelectedItems(true), [item.id]);
				}
				finally {
					stub.restore();
				}
			});
			
			it("should add a duplicate to the collections of the tab it was started from", async function () {
				await viewA.itemsView.selectItem(item1.id);
				let duplicate = await runWhileTabBSelected(() => zp.duplicateSelectedItem());
				assert.isTrue(duplicate.inCollection(collection1.id));
			});
			
			it("should restore the items selected in the tab it was started from", async function () {
				let trashed = await createDataObject('item', { deleted: true });
				await selectTrash(win);
				await viewA.itemsView.selectItem(trashed.id);
				await runWhileTabBSelected(() => zp.restoreSelectedItems());
				assert.isFalse(trashed.deleted);
			});
			
			it("should import from the clipboard into the tab it was started from", async function () {
				Zotero.Utilities.Internal.copyTextToClipboard(
					"@article{tab_test_nodate,\n	title = {Tab Import},\n}"
				);
				let addPromise = waitForItemEvent('add');
				let promise = win.Zotero_File_Interface.importFromClipboard();
				tabs.select(tabB);
				await promise;
				let item = Zotero.Items.get((await addPromise)[0]);
				assert.isTrue(item.inCollection(collection1.id));
			});
		});
		
		it("should open the current collections in a new tab", async function () {
			zp.newLibraryTab();
			let view = await waitForLibraryView(tabs.selectedID);
			assert.deepEqual(getRowIDs(view), ['C' + collection1.id]);
			assert.equal(tabs._getTab(tabs.selectedID).tab.title, collection1.name);
		});
		
		it("should open the newLibraryTabTarget pref's target in a new tab", async function () {
			try {
				// A collection tree row id opens that row
				Zotero.Prefs.set('newLibraryTabTarget', 'C' + collection2.id);
				zp.newLibraryTab();
				let view = await waitForLibraryView(tabs.selectedID);
				assert.deepEqual(getRowIDs(view), ['C' + collection2.id]);
				
				// A no-longer-existing target falls back to My Library
				Zotero.Prefs.set('newLibraryTabTarget', 'C' + (collection2.id + 12345));
				zp.newLibraryTab();
				view = await waitForLibraryView(tabs.selectedID);
				assert.deepEqual(getRowIDs(view), ['L' + Zotero.Libraries.userLibraryID]);
			}
			finally {
				Zotero.Prefs.clear('newLibraryTabTarget');
			}
		});
		
		it("should duplicate a library tab with its view", async function () {
			await setQuickSearch('Item One');
			await zp.itemsView.selectItem(item1.id);
			let { tab, tabIndex } = tabs._getTab(tabs.selectedID);
			
			await tabs.tabHooks.duplicate.library(tab, tabIndex);
			assert.notEqual(tabs.selectedID, tab.id);
			let view = await waitForLibraryView(tabs.selectedID);
			assert.deepEqual(getRowIDs(view), ['C' + collection1.id]);
			assert.equal(view.getElement('zotero-tb-search').value, 'Item One');
			assert.sameMembers(view.itemsView.getSelectedItems(true), [item1.id]);
		});
		
		it("should reopen a closed library tab with its view", async function () {
			let { id, view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			view.getElement('zotero-tb-search').value = 'Item Two';
			await view.search();
			await view.itemsView.selectItem(item2.id);
			assert.isTrue(tabs.canClose(id));
			
			tabs.close(id);
			assert.notInclude(tabs._tabs.map(tab => tab.id), id);
			assert.equal(tabs.selectedType, 'library');
			
			await tabs.undoClose();
			let restoredTab = tabs._tabs[1];
			assert.equal(tabs.selectedID, restoredTab.id);
			let restoredView = await waitForLibraryView(restoredTab.id);
			assert.deepEqual(getRowIDs(restoredView), ['C' + collection2.id]);
			assert.equal(restoredView.getElement('zotero-tb-search').value, 'Item Two');
			assert.sameMembers(restoredView.itemsView.getSelectedItems(true), [item2.id]);
		});
		
		it("should update a background library tab's title when its collection is renamed", async function () {
			let primaryView = zp.libraryView;
			let { id } = await addLibraryTab({ collections: ['C' + collection2.id] });
			tabs.select(primaryView.tabID);
			
			collection2.name = 'Library Tab 2 Renamed';
			await collection2.saveTx();
			await waitForCallback(
				() => tabs._getTab(id).tab.title == 'Library Tab 2 Renamed', 50, 5
			);
		});
		
		it("should make the next library view primary when the primary tab is closed", async function () {
			let primaryView = zp.libraryView;
			let { id, view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			assert.equal(zp.primaryLibraryView, primaryView);
			assert.isTrue(tabs.canClose(primaryView.tabID));
			
			tabs.close(primaryView.tabID);
			
			assert.equal(zp.primaryLibraryView, view);
			assert.equal(zp.libraryView, view);
			// The promoted view keeps the ids it was created with
			assert.equal(view.getElement('zotero-tb-add').id, 'zotero-tb-add-' + id);
			assert.deepEqual(getRowIDs(view), ['C' + collection2.id]);
		});
		
		it("should restore an unloaded library tab when it's selected again", async function () {
			let { id, view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			view.getElement('zotero-tb-search').value = 'Item Two';
			await view.search();
			await view.itemsView.selectItem(item2.id);
			let title = tabs._getTab(id).tab.title;
			let lastClosed = Zotero.Session.getLastClosed();
			
			tabs.select(zp.primaryLibraryView.tabID);
			assert.isTrue(tabs.canUnload(id));
			tabs.unload(id);
			await Zotero.Promise.delay(50);
			
			let { tab, tabIndex } = tabs._getTab(id);
			assert.isNull(zp.getLibraryView(id));
			assert.equal(tab.type, 'library-unloaded');
			assert.equal(tab.title, title);
			assert.equal(tabIndex, 1);
			// An unloaded tab isn't a closed one
			assert.equal(Zotero.Session.getLastClosed(), lastClosed);
			
			tabs.select(id);
			let restoredView = await waitForLibraryView(id);
			assert.notEqual(restoredView, view);
			assert.deepEqual(getRowIDs(restoredView), ['C' + collection2.id]);
			assert.equal(restoredView.getElement('zotero-tb-search').value, 'Item Two');
			assert.sameMembers(restoredView.itemsView.getSelectedItems(true), [item2.id]);
		});
		
		it("should make the next library view primary when the primary view is unloaded", async function () {
			let primaryView = zp.libraryView;
			let primaryID = primaryView.tabID;
			let { view } = await addLibraryTab({ collections: ['C' + collection2.id] });
			assert.equal(zp.primaryLibraryView, primaryView);
			assert.isTrue(tabs.canUnload(primaryID));
			
			tabs.unload(primaryID);
			
			assert.equal(zp.primaryLibraryView, view);
			assert.equal(zp.libraryView, view);
			let { tab, tabIndex } = tabs._getTab(primaryID);
			assert.equal(tab.type, 'library-unloaded');
			assert.equal(tabIndex, 0);
		});
		
		it("should unload library tabs beyond the loaded-tab cap", async function () {
			this.timeout(60000);
			// More library tabs than the cap allows
			for (let i = 0; i < 6; i++) {
				await addLibraryTab();
			}
			let libraryTabs = tabs._tabs.filter(tab => tabs.isLibraryTab(tab.id));
			let titles = new Map(libraryTabs.map(tab => [tab.id, tab.title]));
			
			tabs.unloadUnusedTabs();
			
			let loadedIDs = libraryTabs.map(tab => tab.id).filter(id => zp.getLibraryView(id));
			assert.isBelow(loadedIDs.length, libraryTabs.length);
			assert.include(loadedIDs, tabs.selectedID);
			// Unloaded tabs keep their place and title
			for (let [index, { id }] of libraryTabs.entries()) {
				assert.equal(tabs._getTab(id).tabIndex, index);
				assert.equal(tabs._getTab(id).tab.title, titles.get(id));
			}
		});
		
		it("should not unload a window's last loaded library view", async function () {
			let libraryTabID = zp.libraryView.tabID;
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win });
			await reader._initPromise;
			assert.equal(tabs.selectedID, reader.tabID);
			assert.isFalse(tabs.canUnload(libraryTabID));
			
			let { id } = await addLibraryTab();
			tabs.select(reader.tabID);
			assert.isTrue(tabs.canUnload(id));
		});
		
		it("should keep working in a window with no library view", async function () {
			let win2 = await loadZoteroPane();
			try {
				let zp2 = win2.ZoteroPane;
				let tabs2 = win2.Zotero_Tabs;
				// Another tab, so that closing the library tab doesn't close the window
				await Zotero.Reader.open(attachment.id, null, { window: win2 });
				tabs2.close(zp2.libraryView.tabID);
				
				assert.isNull(zp2.libraryView);
				assert.isNull(zp2.primaryLibraryView);
				assert.isNull(zp2.itemsView);
				assert.isNull(zp2.collectionsView);
				zp2.handleBlur({ target: win2.document.documentElement, relatedTarget: null });
				assert.isEmpty(zp2.getCollectionTreeRows());
				assert.isEmpty(zp2.getSelectedItems(true, { libraryTabOnly: true }));
				assert.isUndefined(zp2.setItemsPaneMessage('Message'));
				zp2.updateLayout();
				
				// A view created without a primary takes the base ids
				zp2.newLibraryTab();
				await waitForCallback(() => zp2.libraryView?.loaded, 50, 10);
				assert.equal(zp2.primaryLibraryView, zp2.libraryView);
				assert.equal(zp2.libraryView.getElement('zotero-tb-add').id, 'zotero-tb-add');
			}
			finally {
				win2.close();
			}
		});
		
		it("should close a window when its last tab is closed", async function () {
			let win2 = await loadZoteroPane();
			win2.Zotero_Tabs.close(win2.Zotero_Tabs.selectedID);
			await waitForCallback(() => win2.closed, 50, 10);
		});

		it("should keep the last tab of the last window open outside of macOS", async function () {
			let stub = sinon.stub(Zotero, 'isMac').value(false);
			try {
				await resetTabs();
				let isClosable = () => doc.querySelector('.tab.selected').classList.contains('closable');
				let closeCommand = doc.getElementById('cmd_close');
				let win2 = await loadZoteroPane();
				assert.isTrue(tabs.canClose());
				assert.isTrue(isClosable());
				assert.isFalse(closeCommand.hasAttribute('disabled'));
				
				win2.close();
				await waitForCallback(() => !isClosable(), 50, 10);
				assert.isFalse(tabs.canClose());
				assert.isTrue(closeCommand.hasAttribute('disabled'));
			}
			finally {
				stub.restore();
			}
		});
		
		it("should release a library view's trees when its tab is closed while loading", async function () {
			let LibraryView = win.customElements.get('library-view');
			let CollectionTree = win.require('zotero/collectionTree');
			let loadSpy = sinon.spy(LibraryView.prototype, 'load');
			let refreshSpy = sinon.spy(CollectionTree.prototype, 'refresh');
			try {
				let id = tabs.addLibraryTab();
				let view = tabs.getTabContent(id).querySelector('library-view');
				tabs.close(id);
				await loadSpy.firstCall.returnValue.catch(() => {});
				// The collections tree finishes its first refresh after the view stops loading
				await refreshSpy.getCalls().find(call => call.thisValue === view.collectionsView)
					?.returnValue;
				
				assert.isFalse(view.loaded);
				assert.isFalse(!!Zotero.crashed);
				for (let tree of [view.itemsView, view.collectionsView]) {
					assert.isTrue(!tree || tree._uninitialized);
				}
			}
			finally {
				loadSpy.restore();
				refreshSpy.restore();
			}
		});
		
		it("should notify plugins when a window's library views load and go away", async function () {
			let loadSpy = sinon.spy(Zotero.Plugins, 'notifyMainWindowLoad');
			let unloadSpy = sinon.spy(Zotero.Plugins, 'notifyMainWindowUnload');
			let win2;
			try {
				win2 = await loadZoteroPane();
				await waitForCallback(() => loadSpy.calledWith(win2), 50, 10);
				assert.isFalse(unloadSpy.calledWith(win2));
				
				await Zotero.Reader.open(attachment.id, null, { window: win2 });
				win2.Zotero_Tabs.close(win2.ZoteroPane.libraryView.tabID);
				assert.isTrue(unloadSpy.calledWith(win2));
			}
			finally {
				loadSpy.restore();
				unloadSpy.restore();
				win2?.close();
			}
		});
		
		it("should round-trip library tabs through getState() and restoreState()", async function () {
			await zp.itemsView.selectItem(item1.id);
			await addLibraryTab({ collections: ['C' + collection2.id] });
			await setQuickSearch('Item Two');
			
			// The session keeps only the collection selection of a library tab
			let state = tabs.getState();
			let libraryTabs = state.filter(tab => tab.type == 'library');
			assert.lengthOf(libraryTabs, 2);
			assert.hasAllKeys(libraryTabs[0].data.state, ['collections', 'focusedCollection']);
			assert.deepEqual(libraryTabs[0].data.state.collections, ['C' + collection1.id]);
			assert.deepEqual(libraryTabs[1].data.state.collections, ['C' + collection2.id]);
			assert.isTrue(libraryTabs[1].selected);
			
			// Start over with no tabs, as at startup
			tabs.close(tabs._tabs.map(tab => tab.id), { skipWindowClose: true });
			assert.isNull(zp.libraryView);
			await tabs.restoreState(state);
			
			assert.lengthOf(tabs._tabs.filter(tab => tabs.isLibraryTab(tab.id)), 2);
			let view = await waitForLibraryView(tabs.selectedID);
			assert.deepEqual(getRowIDs(view), ['C' + collection2.id]);
			
			// The other tab's view is created when the tab is first shown
			tabs.select(tabs._tabs[0].id);
			let otherView = await waitForLibraryView(tabs.selectedID);
			assert.deepEqual(getRowIDs(otherView), ['C' + collection1.id]);
		});
	});

	describe("Library-targeted routing", function () {
		var group, groupItem, item, attachment;
		
		before(async function () {
			group = await createGroup({ name: 'Routing Group' });
			groupItem = await createDataObject('item', {
				title: 'Routing Group Item',
				libraryID: group.libraryID
			});
			item = await createDataObject('item', { title: 'Routing Item' });
			attachment = await importPDFAttachment(item);
		});
		
		beforeEach(async function () {
			await resetTabs();
		});
		
		after(async function () {
			await resetTabs();
		});
		
		it("should select an item in a library tab that already shows its library", async function () {
			let primaryView = zp.libraryView;
			let primaryRows = getRowIDs(primaryView);
			let { id, view } = await addLibraryTab({ collections: ['L' + group.libraryID] });
			tabs.select(primaryView.tabID);
			
			await zp.selectItems([groupItem.id]);
			
			assert.equal(tabs.selectedID, id);
			assert.deepEqual(view.itemsView.getSelectedItems(true), [groupItem.id]);
			// The other tab keeps showing what it was showing
			assert.deepEqual(getRowIDs(primaryView), primaryRows);
		});
		
		it("should create a library view to select an item in a window without one", async function () {
			let win2 = await loadZoteroPane();
			try {
				let zp2 = win2.ZoteroPane;
				// Another tab, so that closing the library tab doesn't close the window
				await Zotero.Reader.open(attachment.id, null, { window: win2 });
				win2.Zotero_Tabs.close(zp2.libraryView.tabID);
				assert.isNull(zp2.libraryView);
				
				await zp2.selectItems([item.id]);
				
				assert.isNotNull(zp2.libraryView);
				assert.deepEqual(zp2.itemsView.getSelectedItems(true), [item.id]);
			}
			finally {
				win2.close();
			}
		});
		
		it("should use a window with a library view for a library action", async function () {
			let win2 = await loadZoteroPane();
			try {
				let zp2 = win2.ZoteroPane;
				await Zotero.Reader.open(attachment.id, null, { window: win2 });
				win2.Zotero_Tabs.close(zp2.libraryView.tabID);
				assert.isNull(zp2.libraryView);
				
				let mainWindow = Zotero.getMainWindow();
				assert.notEqual(mainWindow, win2);
				assert.isNotNull(mainWindow.ZoteroPane.libraryView);
			}
			finally {
				win2.close();
			}
		});
	});

	describe("Multiple windows", function () {
		var win2, zp2, collection, item, otherItem;
		
		before(async function () {
			collection = await createDataObject('collection', { name: 'Second Window' });
			item = await createDataObject('item', {
				title: 'Second Window Item One',
				collections: [collection.id]
			});
			otherItem = await createDataObject('item', {
				title: 'Second Window Item Two',
				collections: [collection.id]
			});
			win2 = await loadZoteroPane();
			zp2 = win2.ZoteroPane;
		});
		
		after(async function () {
			if (win2) {
				win2.close();
			}
			// Leave the window showing its library, as other tests expect
			await selectLibrary(win);
		});
		
		it("should open a reader tab in the window that requested it", async function () {
			let attachment = await importPDFAttachment(item);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win2 });
			await reader._initPromise;
			try {
				assert.equal(reader._window, win2);
				assert.include(win2.Zotero_Tabs._tabs.map(tab => tab.id), reader.tabID);
				assert.notInclude(win.Zotero_Tabs._tabs.map(tab => tab.id), reader.tabID);
				assert.equal(win2.Zotero_Tabs.selectedID, reader.tabID);
				assert.equal(win.Zotero_Tabs.selectedType, 'library');
			}
			finally {
				win2.Zotero_Tabs.close(reader.tabID);
			}
		});
		
		it("should leave another window's panes alone when a tab is selected", async function () {
			await selectCollection(win2, collection);
			await zp2.selectItem(item.id);
			let splitter = win2.ZoteroContextPane.splitter;
			assert.isTrue(splitter.hasAttribute('hidden'));
			
			let attachment = await importPDFAttachment(otherItem);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win });
			await reader._initPromise;
			try {
				// The other window's reader tab leaves this window showing its library
				assert.isTrue(splitter.hasAttribute('hidden'));
				
				// The item pane keeps following this window's selection
				await zp2.selectItem(otherItem.id);
				let infoBox = zp2.itemPane._itemDetails.getPane('info');
				await waitForCallback(
					() => infoBox.querySelector('#itembox-field-value-title')?.value
						=== 'Second Window Item Two',
					100,
					5
				);
			}
			finally {
				win.Zotero_Tabs.close(reader.tabID);
			}
		});
		
		it("should keep item pane and quick search settings to each window", async function () {
			await selectCollection(win, collection);
			await win.ZoteroPane.selectItem(item.id);
			await selectCollection(win2, collection);
			await zp2.selectItem(item.id);
			let getSection = w => w.ZoteroPane.itemPane._itemDetails
				.querySelector('collapsible-section[data-pane="info"]');
			let open = getSection(win).open;
			let mode = Zotero.Prefs.getForWindow(win, 'search.quicksearch-mode');
			let otherMode = mode == 'fields' ? 'titleCreatorYear' : 'fields';
			try {
				getSection(win2).open = !open;
				assert.equal(getSection(win).open, open);
				// The pref holds the most recent change, for windows that open without one
				assert.equal(Zotero.Prefs.get('panes.info.open'), !open);
				
				zp2.libraryView.getElement('zotero-tb-search').searchModePopup
					.querySelector(`menuitem[value="${otherMode}"]`).doCommand();
				assert.equal(Zotero.Prefs.getForWindow(win2, 'search.quicksearch-mode'), otherMode);
				assert.equal(Zotero.Prefs.getForWindow(win, 'search.quicksearch-mode'), mode);
			}
			finally {
				getSection(win2).open = open;
				Zotero.Prefs.setForWindow(win2, 'search.quicksearch-mode', mode);
			}
		});
		
		it("should reopen a window with its own settings", async function () {
			let mode = Zotero.Prefs.getForWindow(win, 'search.quicksearch-mode');
			let otherMode = mode == 'fields' ? 'titleCreatorYear' : 'fields';
			let isDateAddedHidden = view => view.itemsView._getColumns()
				.find(column => column.dataKey == 'dateAdded').hidden;
			let dateAddedHidden = isDateAddedHidden(zp.libraryView);
			
			let win3 = await loadZoteroPane();
			Zotero.Prefs.setForWindow(win3, 'search.quicksearch-mode', otherMode);
			let itemsView = win3.ZoteroPane.itemsView;
			itemsView.tree._columns.toggleHidden(
				itemsView._getColumns().findIndex(column => column.dataKey == 'dateAdded')
			);
			let openWindows = Zotero.getMainWindows();
			win3.close();
			await waitForCallback(() => win3.closed, 50, 20);
			
			await tabs.undoClose();
			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.ZoteroPane.libraryView?.loaded,
					100,
					20
				);
				assert.equal(Zotero.Prefs.getForWindow(newWin, 'search.quicksearch-mode'), otherMode);
				assert.equal(isDateAddedHidden(newWin.ZoteroPane.libraryView), !dateAddedHidden);
				
				assert.equal(Zotero.Prefs.getForWindow(win, 'search.quicksearch-mode'), mode);
				await zp.itemsView.reloadColumnPrefs();
				assert.equal(isDateAddedHidden(zp.libraryView), dateAddedHidden);
			}
			finally {
				newWin?.close();
				Zotero.Prefs.set('search.quicksearch-mode', mode);
			}
		});
		
		it("should open each selected collection in a tab of its own in a new window", async function () {
			let otherCollection = await createDataObject('collection');
			await zp2.collectionsView.restoreSelection([collection.treeViewID, otherCollection.treeViewID]);
			// In tree order
			let rowIDs = zp2.getCollectionTreeRows().map(row => row.id);
			let newWin;
			try {
				newWin = zp2.openCollectionsInNewWindow();
				await waitForCallback(
					() => newWin.ZoteroPane
						&& newWin.ZoteroPane.getCollectionTreeRows().map(row => row.id).join()
							=== rowIDs[0],
					100,
					10
				);
				assert.notEqual(newWin.Zotero_Tabs.windowID, win2.Zotero_Tabs.windowID);
				let libraryTabs = newWin.Zotero_Tabs._tabs.filter(tab => newWin.Zotero_Tabs.isLibraryTab(tab.id));
				assert.equal(newWin.Zotero_Tabs.selectedID, libraryTabs[0].id);
				assert.deepEqual(libraryTabs.map(tab => tab.data.state.collections), rowIDs.map(id => [id]));
			}
			finally {
				await selectCollection(win2, collection);
				if (newWin) {
					newWin.close();
				}
			}
		});
		
		it("should open the Advanced Search in a new window", async function () {
			let newWin;
			try {
				newWin = zp.openAdvancedSearchInNewWindow('foo');
				await waitForCallback(
					() => {
						let deck = newWin.document
							?.getElementById('zotero-advanced-search-pane-deck');
						return deck?.state === 'open'
							&& deck.pane.search
							&& Object.values(deck.pane.search.getConditions())
								.some(c => c.condition == 'anyField' && c.value == 'foo');
					},
					100,
					10
				);
				// The search is focused, as it would be when opened within the window
				let deck = newWin.document.getElementById('zotero-advanced-search-pane-deck');
				await waitForCallback(
					() => deck.pane.contains(newWin.document.activeElement),
					100,
					5
				);
			}
			finally {
				if (newWin) {
					newWin.close();
				}
			}
		});
		
		it("should move a reader tab to a new window with no library view", async function () {
			let attachment = await importPDFAttachment(otherItem);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win2 });
			await reader._initPromise;
			let sourceTabID = reader.tabID;
			let { tab, tabIndex } = win2.Zotero_Tabs._getTab(sourceTabID);
			let openWindows = Zotero.getMainWindows();
			let wasCollapsed = win2.ZoteroContextPane.collapsed;
			win2.ZoteroContextPane.collapsed = false;
			await win2.Zotero_Tabs.tabHooks.moveToNewWindow.reader(tab, tabIndex);

			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.Zotero_Tabs?.numTabs,
					100,
					20
				);
				await waitForCallback(() => !win2.Zotero_Tabs._getTab(sourceTabID).tab, 50, 20);
				assert.isNull(newWin.ZoteroPane.libraryView);
				assert.equal(newWin.Zotero_Tabs.parseTabType().tabContentType, 'reader');
				// The reader itself moves, rather than a new one being opened for the item
				assert.equal(Zotero.Reader.getByTabID(newWin.Zotero_Tabs.selectedID), reader);
				// The context pane is open, as in the window it came from
				assert.isAbove(
					newWin.document.getElementById('zotero-context-pane').getBoundingClientRect().width, 0
				);
			}
			finally {
				win2.ZoteroContextPane.collapsed = wasCollapsed;
				newWin?.close();
			}
		});
		
		it("should move a library tab to another window with its collection selection", async function () {
			let { id } = await addLibraryTab({ collections: ['C' + collection.id] });
			let refocus = sinon.spy(tabs.tabHooks.refocus, 'library');
			let newID;
			try {
				newID = await tabs.moveToWindow(id, win2);
				// The window the tab left selects another tab without taking focus from the window
				// the tab went to
				await Zotero.Promise.delay(50);
				assert.isFalse(refocus.called);
			}
			finally {
				refocus.restore();
			}
			try {
				assert.isUndefined(tabs._getTab(id).tab);
				assert.equal(win2.Zotero_Tabs.selectedID, newID);
				await waitForCallback(
					() => win2.ZoteroPane.getLibraryView(newID)?.loaded, 50, 10
				);
				let view = win2.ZoteroPane.getLibraryView(newID);
				await view.waitForLibraryTabState();
				assert.deepEqual(getRowIDs(view), ['C' + collection.id]);
			}
			finally {
				if (win2.Zotero_Tabs._getTab(newID).tab) {
					win2.Zotero_Tabs.close(newID);
				}
			}
		});
		
		it("should move a tab dropped on another window's tab bar", async function () {
			let { id } = await addLibraryTab();
			let tabNode = win.document.querySelector(`#tab-bar-container .tabs-wrapper .tab[data-id="${id}"]`);
			let tabBar = win2.document.querySelector('#tab-bar-container .tabs-wrapper .tabs');
			let dataTransfer = new win.DataTransfer();
			let fire = (target, type) => target.dispatchEvent(
				new target.ownerDocument.defaultView.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer })
			);
			let count = win2.Zotero_Tabs._tabs.length;
			fire(tabNode, 'dragstart');
			fire(tabBar, 'dragover');
			fire(tabBar, 'drop');
			fire(tabNode, 'dragend');
			await waitForCallback(() => win2.Zotero_Tabs._tabs.length > count, 50, 10);
			let newID = win2.Zotero_Tabs.selectedID;
			try {
				assert.isUndefined(tabs._getTab(id).tab);
				assert.isTrue(win2.Zotero_Tabs.isLibraryTab(newID));
			}
			finally {
				win2.Zotero_Tabs.close(newID);
			}
		});

		/**
		 * Drag a library tab out of the window and drop it where nothing takes it
		 *
		 * @param {Number} screenX
		 * @param {Number} screenY
		 * @return {String} - The id of the dragged tab
		 */
		async function dropTabOutsideTabBar(screenX, screenY) {
			let { id } = await addLibraryTab();
			let tabNode = win.document.querySelector(`#tab-bar-container .tabs-wrapper .tab[data-id="${id}"]`);
			let dataTransfer = new win.DataTransfer();
			tabNode.dispatchEvent(new win.DragEvent('dragstart', { bubbles: true, dataTransfer }));
			tabNode.dispatchEvent(new win.DragEvent('dragend', { bubbles: true, dataTransfer, screenX, screenY }));
			return id;
		}

		it("should tear off a tab dropped outside the tab bar into a new window", async function () {
			let openWindows = Zotero.getMainWindows();
			let id = await dropTabOutsideTabBar(win.screenX + 100, win.screenY + win.outerHeight - 50);
			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.Zotero_Tabs?.numTabs,
					100,
					20
				);
				assert.isUndefined(tabs._getTab(id).tab);
				assert.isTrue(newWin.Zotero_Tabs.isLibraryTab(newWin.Zotero_Tabs.selectedID));
			}
			finally {
				newWin?.close();
			}
		});

		it("should keep a tab dropped just below its tab bar", async function () {
			let tabBar = win.document.querySelector('#tab-bar-container .tabs-wrapper .tabs');
			let { left, bottom } = tabBar.getBoundingClientRect();
			let openWindows = Zotero.getMainWindows();
			let id = await dropTabOutsideTabBar(
				win.mozInnerScreenX + left + 50, win.mozInnerScreenY + bottom + 5
			);
			try {
				await Zotero.Promise.delay(500);
				assert.ok(tabs._getTab(id).tab);
				assert.sameMembers(Zotero.getMainWindows(), openWindows);
			}
			finally {
				if (tabs._getTab(id).tab) {
					tabs.close(id);
				}
			}
		});

		it("should reopen a tab closed in another window at the end of this one", async function () {
			let { id } = await addLibraryTab({ collections: [collection.treeViewID] });
			tabs.close(id);
			await win2.Zotero_Tabs.undoClose();
			let newID = win2.Zotero_Tabs.selectedID;
			try {
				assert.equal(win2.Zotero_Tabs._getTab(newID).tabIndex, win2.Zotero_Tabs._tabs.length - 1);
				let view = await waitForCallback(() => win2.ZoteroPane.getLibraryView(newID)?.loaded
					&& win2.ZoteroPane.getLibraryView(newID), 50, 20);
				await view.waitForLibraryTabState();
				assert.deepEqual(view.getCollectionTreeRows().map(row => row.id), [collection.treeViewID]);
			}
			finally {
				win2.Zotero_Tabs.close(newID);
			}
		});
		
		it("should reopen a closed window with its tabs", async function () {
			let win3 = await loadZoteroPane();
			win3.Zotero_Tabs.addLibraryTab({ state: { collections: [collection.treeViewID] } });
			let tabCount = win3.Zotero_Tabs._tabs.length;
			let openWindows = Zotero.getMainWindows();
			win3.close();
			await waitForCallback(() => win3.closed, 50, 20);
			
			await tabs.undoClose();
			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.Zotero_Tabs?.numTabs == tabCount,
					100,
					20
				);
				assert.isTrue(newWin.Zotero_Tabs.isLibraryTab(newWin.Zotero_Tabs.selectedID));
			}
			finally {
				newWin?.close();
			}
		});
		
		it("should reopen a window closed by closing its last tab", async function () {
			let attachment = await importPDFAttachment(await createDataObject('item'));
			let win3 = await loadZoteroPane();
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win3 });
			win3.Zotero_Tabs.close(win3.ZoteroPane.libraryView.tabID);
			let openWindows = Zotero.getMainWindows();
			win3.Zotero_Tabs.close(reader.tabID);
			await waitForCallback(() => win3.closed, 50, 20);
			
			await tabs.undoClose();
			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.Zotero_Tabs?.numTabs,
					100,
					20
				);
				assert.equal(newWin.Zotero_Tabs._tabs.length, 1);
				assert.equal(newWin.Zotero_Tabs.parseTabType().tabContentType, 'reader');
			}
			finally {
				newWin?.close();
			}
		});
		
		/**
		 * Drag items, collections, or saved searches over another window's tab bar and drop them
		 * at its end
		 *
		 * @param {String} type
		 * @param {Integer[]} ids
		 */
		function dropOnTabBar(type, ids) {
			let tabBar = win2.document.querySelector('#tab-bar-container .tabs-wrapper .tabs');
			let { right, top } = tabBar.getBoundingClientRect();
			let dataTransfer = new win2.DataTransfer();
			dataTransfer.setData(type, ids.join(','));
			for (let eventType of ['dragover', 'drop']) {
				tabBar.dispatchEvent(new win2.DragEvent(eventType, {
					bubbles: true, cancelable: true, dataTransfer, clientX: right - 5, clientY: top + 5
				}));
			}
		}

		it("should select a tab that a drag rests on", async function () {
			let targetID = win2.Zotero_Tabs.selectedID;
			let id = win2.Zotero_Tabs.addLibraryTab();
			try {
				await waitForCallback(
					() => win2.document.querySelector(`#tab-bar-container .tab.selected[data-id="${id}"]`),
					50,
					20
				);
				let tabNode = win2.document.querySelector(`#tab-bar-container .tab[data-id="${targetID}"]`);
				let dataTransfer = new win2.DataTransfer();
				dataTransfer.setData('zotero/item', String(item.id));
				tabNode.dispatchEvent(
					new win2.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer })
				);
				assert.equal(win2.Zotero_Tabs.selectedID, id);
				await waitForCallback(() => win2.Zotero_Tabs.selectedID == targetID, 100, 20);
			}
			finally {
				win2.Zotero_Tabs.close(id);
			}
		});

		it("should open a collection dropped on the tab bar in a new tab", async function () {
			let count = win2.Zotero_Tabs._tabs.length;
			dropOnTabBar('zotero/collection', [collection.id]);
			let newID = win2.Zotero_Tabs.selectedID;
			try {
				assert.equal(win2.Zotero_Tabs._tabs.length, count + 1);
				assert.equal(win2.Zotero_Tabs._getTab(newID).tabIndex, count);
				await waitForCallback(() => win2.ZoteroPane.getLibraryView(newID)?.loaded, 50, 20);
				let view = win2.ZoteroPane.getLibraryView(newID);
				await view.waitForLibraryTabState();
				assert.deepEqual(view.getCollectionTreeRows().map(row => row.id), [collection.treeViewID]);
			}
			finally {
				win2.Zotero_Tabs.close(newID);
			}
		});

		it("should open an item dropped on the tab bar in a reader tab", async function () {
			let parentItem = await createDataObject('item');
			let attachment = await importPDFAttachment(parentItem);
			dropOnTabBar('zotero/item', [parentItem.id]);
			let reader;
			await waitForCallback(
				() => (reader = Zotero.Reader.getByTabID(win2.Zotero_Tabs.selectedID)),
				50,
				20
			);
			try {
				assert.equal(reader.itemID, attachment.id);
				assert.equal(reader._window, win2);
			}
			finally {
				reader.close();
			}
		});

		it("should show an item with nothing to open dropped on the tab bar in a library tab", async function () {
			let newItem = await createDataObject('item');
			let count = win2.Zotero_Tabs._tabs.length;
			dropOnTabBar('zotero/item', [newItem.id]);
			await waitForCallback(() => win2.Zotero_Tabs._tabs.length > count, 50, 20);
			let newID = win2.Zotero_Tabs.selectedID;
			try {
				await waitForCallback(() => win2.ZoteroPane.getLibraryView(newID)?.loaded, 50, 20);
				let view = win2.ZoteroPane.getLibraryView(newID);
				await view.waitForLibraryTabState();
				assert.sameMembers(view.itemsView.getSelectedItems(true), [newItem.id]);
			}
			finally {
				win2.Zotero_Tabs.close(newID);
			}
		});

		it("should move a reader tab to another window", async function () {
			let attachment = await importPDFAttachment(otherItem);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win });
			await reader._initPromise;
			let sourceTabID = reader.tabID;
			let readerWindow = reader._iframeWindow;
			readerWindow.wrappedJSObject.movedReaderMarker = 'moved';
			let newID = await tabs.moveToWindow(sourceTabID, win2);
			try {
				assert.isUndefined(tabs._getTab(sourceTabID).tab);
				assert.equal(win2.Zotero_Tabs.selectedID, newID);
				// The reader and its document move, rather than being reopened
				assert.equal(Zotero.Reader.getByTabID(newID), reader);
				assert.equal(reader._window, win2);
				assert.equal(reader._iframeWindow, readerWindow);
				assert.equal(reader._iframe.contentWindow.wrappedJSObject.movedReaderMarker, 'moved');
			}
			finally {
				if (win2.Zotero_Tabs._getTab(newID).tab) {
					win2.Zotero_Tabs.close(newID);
				}
			}
		});
		
		it("should keep a moved reader working after its old window closes", async function () {
			let win3 = await loadZoteroPane();
			let attachment = await importPDFAttachment(otherItem);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win3 });
			await reader._initPromise;
			let newID = await win3.Zotero_Tabs.moveToWindow(reader.tabID, win2);
			win3.close();
			try {
				// Switching away and back lays the reader out in its new window
				win2.Zotero_Tabs.select(zp2.libraryView.tabID);
				win2.Zotero_Tabs.select(newID);
				await reader.navigate({ pageIndex: 0 });
				assert.isFalse(win2.document.getElementById('zotero-context-splitter').hasAttribute('hidden'));
			}
			finally {
				win2.Zotero_Tabs.close(newID);
			}
			await waitForCallback(() => !Zotero.Reader._readers.includes(reader), 50, 20);
		});
		
		it("should keep a moved reader's position when another reader saved a different one", async function () {
			let attachment = await importFileAttachment('wonderland_long.pdf', {
				contentType: 'application/pdf',
				parentID: otherItem.id
			});
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win });
			await reader._initPromise;
			await reader.navigate({ pageIndex: 3 });
			await waitForCallback(() => reader.getPrimaryViewState()?.pageIndex === 3, 100, 10);
			// Let the reader's view state changes settle and its saved state be written
			await Zotero.Promise.delay(1000);
			await reader._flushState();
			assert.notOk(reader._pendingWriteStateFunction);
			// Another reader for the attachment saves a different position
			await attachment.setAttachmentLastPageIndex(7);
			
			let newID = await tabs.moveToWindow(reader.tabID, win2);
			try {
				await win2.Zotero_Tabs.getLoadPromise(newID);
				let movedReader = Zotero.Reader.getByTabID(newID);
				assert.equal(movedReader.getPrimaryViewState().pageIndex, 3);
			}
			finally {
				if (win2.Zotero_Tabs._getTab(newID).tab) {
					win2.Zotero_Tabs.close(newID);
				}
			}
		});
		
		it("should close the source window when its last tab is moved", async function () {
			let openWindows = Zotero.getMainWindows();
			let win3 = Zotero.openMainWindow({
				libraryTabState: { collections: ['C' + collection.id] }
			});
			let newID;
			try {
				await waitForCallback(
					() => win3.ZoteroPane?.libraryView?.loaded && win3.Zotero_Tabs.numTabs == 1,
					100,
					10
				);
				await win3.ZoteroPane.libraryView.waitForLibraryTabState();
				newID = await win3.Zotero_Tabs.moveToWindow(win3.Zotero_Tabs.selectedID, win2);
				assert.equal(win2.Zotero_Tabs.selectedID, newID);
				await waitForCallback(() => win3.closed, 50, 10);
				assert.sameMembers(Zotero.getMainWindows(), openWindows);
			}
			finally {
				if (!win3.closed) {
					win3.close();
				}
				if (newID && win2.Zotero_Tabs._getTab(newID).tab) {
					win2.Zotero_Tabs.close(newID);
				}
			}
		});
		
		it("should show tags in a reinitialized tag selector while another window is open", async function () {
			await item.addTag('second-window-tag');
			await item.saveTx();
			
			// Hide the other window's tag selector so that this window's tag selector can't
			// accidentally work against it
			let otherShown = zp2.tagSelectorShown();
			if (otherShown) {
				await zp2.toggleTagSelector();
			}
			await selectCollection(win, collection);
			await waitForItemsLoad(win);
			try {
				if (zp.tagSelectorShown()) {
					await zp.toggleTagSelector();
				}
				await zp.toggleTagSelector();
				await waitForCallback(
					() => [...win.document.querySelectorAll('#zotero-tag-selector .tag-selector-item')]
						.some(node => node.textContent === 'second-window-tag'),
					100,
					5
				);
			}
			finally {
				if (otherShown) {
					await zp2.toggleTagSelector();
				}
			}
		});
		
		it("should restore a saved window state into a window opened for it", async function () {
			let sessionState = {
				type: 'pane',
				geometry: { screenX: 60, screenY: 80, width: 980, height: 640, sizemode: 'normal' },
				tabs: [
					{
						type: 'library',
						title: collection.name,
						selected: true,
						data: { state: { collections: ['C' + collection.id] } }
					}
				]
			};
			let windows = Zotero.Session.state.windows;
			// Pending, as at startup
			Zotero.Session.setLastClosedZoteroPaneState(sessionState);
			let newWin;
			try {
				newWin = Zotero.openMainWindow({ sessionState });
				await waitForCallback(
					() => newWin.ZoteroPane
						&& newWin.ZoteroPane.getCollectionTreeRows().map(row => row.id).join()
							=== 'C' + collection.id,
					100,
					10
				);
				assert.equal(newWin.screenX, 60);
				assert.equal(newWin.screenY, 80);
				assert.equal(newWin.outerWidth, 980);
				assert.equal(newWin.outerHeight, 640);
				await waitForCallback(
					() => newWin.ZoteroPane.itemsView?.rowCount === 2,
					100,
					10
				);
				// Once restored, the window saves its own state in place of the saved one
				await waitForCallback(
					() => !Zotero.Session.getPendingPaneStates().length,
					100,
					10
				);
				assert.isNotNull(newWin.ZoteroPane.getState());
			}
			finally {
				if (newWin) {
					newWin.close();
				}
				Zotero.Session.removePendingPaneState(sessionState);
				Zotero.Session.state.windows = windows;
			}
		});

		it("should mark the UI ready when restoring a window with a reader selected", async function () {
			let attachment = await importPDFAttachment(item);
			let sessionState = {
				type: 'pane',
				geometry: {},
				tabs: [
					{
						type: 'library',
						title: collection.name,
						data: { state: { collections: ['C' + collection.id] } }
					},
					{
						type: 'reader',
						title: item.getField('title'),
						selected: true,
						data: { itemID: attachment.id }
					}
				]
			};
			let uiIsReadySpy = sinon.spy(Zotero, 'uiIsReady');
			let newWin;
			try {
				newWin = Zotero.openMainWindow({ sessionState });
				await waitForCallback(() => newWin.ZoteroPane?.getState(), 100, 10);
				// The unselected library tab hasn't loaded a view to mark the UI ready
				assert.isNull(newWin.ZoteroPane.libraryView);
				assert.isTrue(uiIsReadySpy.called);
			}
			finally {
				uiIsReadySpy.restore();
				newWin?.close();
			}
		});
		
		it("should open a library tab in a window restored without tabs", async function () {
			let sessionState = { type: 'pane', geometry: {}, tabs: [] };
			let newWin;
			try {
				newWin = Zotero.openMainWindow({ sessionState });
				await waitForCallback(() => newWin.ZoteroPane?.libraryView?.loaded, 100, 10);
				assert.lengthOf(newWin.Zotero_Tabs._tabs, 1);
				assert.isTrue(newWin.Zotero_Tabs.isLibraryTab(newWin.Zotero_Tabs.selectedID));
			}
			finally {
				newWin?.close();
			}
		});
		
		it("should keep a saved window state in the session until a window restores it", async function () {
			let windows = Zotero.Session.state.windows;
			let sessionState = { type: 'pane', geometry: {}, tabs: [] };
			try {
				// As when the last window is closed on macOS, which the next window opened restores
				Zotero.Session.setLastClosedZoteroPaneState(sessionState);
				assert.deepEqual(Zotero.Session.getPendingPaneStates(), [sessionState]);
				
				await Zotero.Session.save(true);
				let paneStates = Zotero.Session.state.windows.filter(x => x.type == 'pane');
				assert.include(paneStates, sessionState);
				assert.lengthOf(paneStates, Zotero.getZoteroPanes().length + 1);
				
				Zotero.Session.removePendingPaneState(sessionState);
				await Zotero.Session.save(true);
				assert.notInclude(Zotero.Session.state.windows, sessionState);
			}
			finally {
				Zotero.Session.removePendingPaneState(sessionState);
				Zotero.Session.state.windows = windows;
			}
		});

		it("should save a separate session state for each window", function () {
			let states = Zotero.getZoteroPanes().map(pane => pane.getState());
			assert.isAbove(states.length, 1);
			for (let state of states) {
				assert.equal(state.type, 'pane');
				assert.isAbove(state.geometry.width, 0);
				assert.isAbove(state.tabs.length, 0);
			}
		});

		it("should save window states with the most recently activated window last", async function () {
			let panes = Zotero.getZoteroPanes();
			assert.isAbove(panes.length, 1);
			// Mark the first-enumerated window as the last one activated
			panes.forEach((pane, i) => pane.lastActivated = 1000 - i);
			await Zotero.Session.save(true);
			let states = Zotero.Session.state.windows.filter(x => x.type == 'pane');
			assert.deepEqual(states[states.length - 1], panes[0].getState());
		});
		
		it("should open a new window with the context pane state of the window it's opened from", async function () {
			let source = Services.wm.getMostRecentWindow('navigator:browser');
			let splitter = source.document.getElementById('zotero-context-splitter');
			let originalState = splitter.getAttribute('state');
			let state = originalState == 'open' ? 'collapsed' : 'open';
			splitter.setAttribute('state', state);
			let newWin;
			try {
				newWin = Zotero.openMainWindow();
				await waitForCallback(() => newWin.ZoteroPane?.collectionsView, 50, 20);
				assert.equal(
					newWin.document.getElementById('zotero-context-splitter').getAttribute('state'),
					state
				);
			}
			finally {
				splitter.setAttribute('state', originalState);
				newWin?.close();
			}
		});
	});

	describe("Window teardown", function () {
		it("should not leave observers registered after a window is closed", async function () {
			this.timeout(60000);
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', { collections: [collection.id] });
			let notifierBefore = new Set(Zotero.Notifier.getLeakedObserverIDs());
			let prefsBefore = Zotero.Prefs.getLeakedObserverNames();
			
			// Render the library item pane in a second window, and a per-tab item pane
			// in its context pane
			let win2 = await loadZoteroPane();
			await selectCollection(win2, collection);
			await win2.ZoteroPane.selectItem(item.id);
			let otherItem = await createDataObject('item', { collections: [collection.id] });
			let attachment = await importPDFAttachment(otherItem);
			let reader = await Zotero.Reader.open(attachment.id, null, { window: win2 });
			await reader._initPromise;
			
			// The window's observers are still registered while it tears down, and shouldn't be
			// reported as leaked before it's actually gone
			let leakedWhileUnloading = null;
			win2.addEventListener('pagehide', () => {
				leakedWhileUnloading = Zotero.Notifier.getLeakedObserverIDs()
					.filter(id => !notifierBefore.has(id));
			});
			// An object that nothing unregisters, so that it starts reporting as leaked as soon
			// as the window has finished tearing down
			let root = win2.document.documentElement;
			win2.close();
			await waitForCallback(
				() => Zotero.Utilities.Internal.isObjectLeakingWindow(root), 50, 20
			);
			
			assert.deepEqual(
				leakedWhileUnloading, [], 'no observers are reported as leaked while unloading'
			);
			let notifierAfter = Zotero.Notifier.getLeakedObserverIDs()
				.filter(id => !notifierBefore.has(id));
			assert.isEmpty(notifierAfter, 'no notifier observers belong to a closed window');
			
			let prefsAfter = Zotero.Prefs.getLeakedObserverNames();
			for (let name of prefsBefore) {
				let index = prefsAfter.indexOf(name);
				if (index != -1) {
					prefsAfter.splice(index, 1);
				}
			}
			assert.isEmpty(prefsAfter, 'no pref observers belong to a closed window');
		});
	});
});
