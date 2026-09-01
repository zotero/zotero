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

	describe("Library view state", function () {
		var collection, item;

		before(async function () {
			collection = await createDataObject('collection', { name: 'Library View State' });
			item = await createDataObject('item', {
				title: 'Library View State Item',
				collections: [collection.id]
			});
			win.Zotero_Tabs.closeAll();
		});

		it("should round-trip the library view through getState() and restoreState()", async function () {
			await selectCollection(win, collection);

			let state = win.Zotero_Tabs.getState();
			let libraryTab = state.find(tab => tab.type == 'library');
			assert.deepEqual(libraryTab.data.state.collections, ['C' + collection.id]);

			// Move away from the saved view before restoring it
			await selectLibrary(win);

			await win.Zotero_Tabs.restoreState(state);
			await zp.waitForLibraryTabState();

			assert.deepEqual(zp.getCollectionTreeRows().map(row => row.id), ['C' + collection.id]);
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
		
		after(function () {
			if (win2) {
				win2.close();
			}
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
		
		it("should open the selected collections in a new window", async function () {
			await selectCollection(win2, collection);
			let newWin;
			try {
				newWin = zp2.openCollectionsInNewWindow();
				await waitForCallback(
					() => newWin.ZoteroPane
						&& newWin.ZoteroPane.getCollectionTreeRows().map(row => row.id).join()
							=== 'C' + collection.id,
					100,
					10
				);
				assert.notEqual(newWin.Zotero_Tabs.windowID, win2.Zotero_Tabs.windowID);
			}
			finally {
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
			let sessionWindowID = 'win-' + Zotero.Utilities.randomString();
			Zotero.Session.state.windows.push({
				type: 'pane',
				windowID: sessionWindowID,
				geometry: { screenX: 60, screenY: 80, width: 980, height: 640, sizemode: 'normal' },
				tabs: [
					{
						type: 'library',
						title: collection.name,
						selected: true,
						data: { state: { collections: ['C' + collection.id] } }
					}
				]
			});
			let newWin;
			try {
				newWin = Zotero.openMainWindow({ sessionWindowID });
				await waitForCallback(
					() => newWin.ZoteroPane
						&& newWin.ZoteroPane.getCollectionTreeRows().map(row => row.id).join()
							=== 'C' + collection.id,
					100,
					10
				);
				assert.equal(newWin.ZoteroPane.getState().windowID, sessionWindowID);
				assert.equal(newWin.screenX, 60);
				assert.equal(newWin.screenY, 80);
				assert.equal(newWin.outerWidth, 980);
				assert.equal(newWin.outerHeight, 640);
				assert.isEmpty(
					Zotero.Session.getUnclaimedPaneStates()
						.filter(x => x.windowID == sessionWindowID)
				);
				await waitForCallback(
					() => newWin.ZoteroPane.itemsView?.rowCount === 2,
					100,
					10
				);
			}
			finally {
				if (newWin) {
					newWin.close();
				}
				Zotero.Session.state.windows = Zotero.Session.state.windows
					.filter(x => x.windowID != sessionWindowID);
			}
		});

		it("should save a separate session state for each window", function () {
			let states = Zotero.getZoteroPanes().map(pane => pane.getState());
			let windowIDs = states.map(state => state.windowID);
			assert.isAbove(states.length, 1);
			assert.lengthOf(new Set(windowIDs), windowIDs.length);
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
			assert.equal(states[states.length - 1].windowID, panes[0].getState().windowID);
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
