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

	describe("Window teardown", function () {
		it("should not leave observers registered after a window is closed", async function () {
			this.timeout(60000);
			let collection = await createDataObject('collection');
			let item = await createDataObject('item', { collections: [collection.id] });
			let notifierBefore = new Set(Zotero.Notifier.getLeakedObserverIDs());
			let prefsBefore = Zotero.Prefs.getLeakedObserverNames();
			
			// Render the library item pane in a second window
			let win2 = await loadZoteroPane();
			await selectCollection(win2, collection);
			await win2.ZoteroPane.selectItem(item.id);
			
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
