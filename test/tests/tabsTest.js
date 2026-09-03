describe("Zotero_Tabs", function() {
	var win, doc, zp;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		zp = win.ZoteroPane;
	});

	after(function () {
		win.close();
	});

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
			let historyLength = tabs._history.length;
			
			tabs.unload(reader.tabID);
			
			let { tab } = tabs._getTab(reader.tabID);
			assert.equal(tab.type, 'reader-unloaded');
			assert.lengthOf(tabs._history, historyLength);
			tabs.close(reader.tabID);
		});
	});

	describe("Library tabs", function () {
		var tabs, collection1, collection2, item1, item2, attachment;
		
		before(async function () {
			tabs = win.Zotero_Tabs;
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
		
		async function setQuickSearch(value) {
			zp.libraryView.getElement('zotero-tb-search').value = value;
			await zp.search();
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
			let rowEl = collectionsView.tree.getRowElement(
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
		
		it("should open the current collections in a new tab", async function () {
			zp.newLibraryTab();
			let view = await waitForLibraryView(tabs.selectedID);
			assert.deepEqual(getRowIDs(view), ['C' + collection1.id]);
			assert.equal(tabs._getTab(tabs.selectedID).tab.title, collection1.name);
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
			let { tab, tabIndex } = win2.Zotero_Tabs._getTab(reader.tabID);
			let openWindows = Zotero.getMainWindows();
			await win2.Zotero_Tabs.tabHooks.moveToNewWindow.reader(tab, tabIndex);
			assert.isUndefined(win2.Zotero_Tabs._getTab(reader.tabID).tab);
			
			let newWin;
			try {
				await waitForCallback(
					() => (newWin = Zotero.getMainWindows().find(x => !openWindows.includes(x)))
						&& newWin.Zotero_Tabs?.numTabs,
					100,
					20
				);
				assert.isNull(newWin.ZoteroPane.libraryView);
				assert.equal(newWin.Zotero_Tabs.parseTabType().tabContentType, 'reader');
			}
			finally {
				newWin?.close();
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
