"use strict";

describe("Reader", function () {
	var win, zp;

	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});

	after(function () {
		win.Zotero_Tabs.closeAll();
		win.close();
	});

	describe('PDF Reader', function () {
		it('should create/update annotations', async function () {
			var attachment = await importFileAttachment('test.pdf');

			var reader = await Zotero.Reader.open(attachment.itemID);
			await reader._initPromise;
			reader._internalReader._annotationManager._skipAnnotationSavingDebounce = true;

			// Add highlight annotation
			let highlightAnnotation = reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'highlight',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add underline annotation
			let underlineAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'underline',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add note annotation
			let noteAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'note',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add text annotation
			let textAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'text',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[17.70514027630181, 729.1404633368757, 132.24914027630183, 762.1404633368757]],
						fontSize: 14,
						rotation: 10
					},
					text: 'test'
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add image annotation
			let imageAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'image',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					comment: 'test',
					position: {
						pageIndex: 0,
						rects: [[0, 0, 100, 100]]
					}
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");
			// Add ink annotation
			let inkAnnotation = await reader._internalReader._annotationManager.addAnnotation(
				Components.utils.cloneInto({
					type: 'ink',
					color: '#ffd400',
					sortIndex: '00000|003305|00000',
					position: {
						pageIndex: 0,
						paths: [[517.759, 760.229]],
						width: 2
					},
				}, reader._iframeWindow)
			);
			await waitForItemEvent("add");

			// Modify highlight annotation
			reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: highlightAnnotation.id,
						text: 'test2'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify underline annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: underlineAnnotation.id,
						text: 'test2'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify note annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: noteAnnotation.id,
						color: '#aabbcc'
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify text annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: textAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							rects: [[17.70514027630181, 729.1404633368757, 132.24914027630183, 762.1404633368757]],
							fontSize: 16,
							rotation: 10
						},
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify image annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: imageAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 200, 200]]
						}
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");
			// Modify ink annotation
			await reader._internalReader._annotationManager.updateAnnotations(
				Components.utils.cloneInto([
					{
						id: inkAnnotation.id,
						sortIndex: '00000|001491|00283',
						position: {
							pageIndex: 0,
							paths: [[617.759, 560.229]],
							width: 2,
							unknownField: 'test'
						},
					}
				], reader._iframeWindow)
			);
			await waitForItemEvent("modify");

			var annotations = attachment.getAnnotations();
			assert.equal(annotations.length, 6);

			assert.equal(annotations.find(x => x.key === highlightAnnotation.id).annotationText, 'test2');
			assert.equal(annotations.find(x => x.key === underlineAnnotation.id).annotationText, 'test2');
			assert.equal(annotations.find(x => x.key === noteAnnotation.id).annotationColor, '#aabbcc');
			assert.equal(JSON.parse(annotations.find(x => x.key === textAnnotation.id).annotationPosition).fontSize, 16);
			assert.equal(JSON.parse(annotations.find(x => x.key === imageAnnotation.id).annotationPosition).rects[0][2], 200);
			assert.equal(JSON.parse(annotations.find(x => x.key === inkAnnotation.id).annotationPosition).pageIndex, 0);
			assert.equal(JSON.parse(annotations.find(x => x.key === inkAnnotation.id).annotationPosition).unknownField, 'test');
			reader.close();
		});

		async function cleanupReaders(...readers) {
			for (let reader of readers.filter(Boolean)) {
				reader.close();
			}
			await Zotero.Promise.delay(100);
			for (let reader of readers.filter(Boolean)) {
				let index = Zotero.Reader._readers.indexOf(reader);
				if (index !== -1) {
					reader.uninit();
					Zotero.Reader._readers.splice(index, 1);
				}
			}
		}

		it('should record annotation changes in the app-wide undo history', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;
				Zotero.UndoHistory.clear();

				let annotation = annotationManager.addAnnotation(
					Components.utils.cloneInto({
						type: 'highlight',
						color: '#ffd400',
						sortIndex: '00000|003305|00000',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 100, 100]]
						},
						text: 'test'
					}, reader._iframeWindow)
				);
				await waitForItemEvent('add');
				assert.equal(attachment.getAnnotations()[0].key, annotation.id);
				assert.isTrue(Zotero.UndoHistory.canUndo());
				assert.equal(
					Zotero.UndoHistory.getUndoAction().action, 'undo-action-add-annotation'
				);

				// Undoing from outside the reader should move the annotation to the trash
				assert.isTrue(await Zotero.UndoHistory.undo());
				await waitForItemEvent('trash');
				assert.lengthOf(attachment.getAnnotations(), 0);
				assert.lengthOf(attachment.getAnnotations(true), 1);

				// Redoing should restore it from the trash with the same key
				assert.isTrue(await Zotero.UndoHistory.redo());
				await waitForItemEvent('modify');
				assert.lengthOf(attachment.getAnnotations(), 1);
				assert.equal(attachment.getAnnotations()[0].key, annotation.id);

				// An edit should be undoable as its own step
				annotationManager.updateAnnotations(
					Components.utils.cloneInto([{
						id: attachment.getAnnotations()[0].key,
						text: 'test2'
					}], reader._iframeWindow)
				);
				await waitForItemEvent('modify');
				assert.equal(
					Zotero.UndoHistory.getUndoAction().action, 'undo-action-edit-annotation'
				);
				assert.isTrue(await Zotero.UndoHistory.undo());
				await waitForItemEvent('modify');
				assert.equal(attachment.getAnnotations()[0].annotationText, 'test');
			}
			finally {
				await cleanupReaders(reader);
			}

			// A closed reader can't apply its steps anymore
			assert.isFalse(Zotero.UndoHistory.canUndo());
			assert.isFalse(Zotero.UndoHistory.canRedo());
		});

		it('should select the reader tab when undoing an annotation change from the library', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;
				Zotero.UndoHistory.clear();

				annotationManager.addAnnotation(
					Components.utils.cloneInto({
						type: 'highlight',
						color: '#ffd400',
						sortIndex: '00000|003305|00000',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 100, 100]]
						},
						text: 'test'
					}, reader._iframeWindow)
				);
				await waitForItemEvent('add');

				win.Zotero_Tabs.select('zotero-pane');
				assert.isTrue(await Zotero.UndoHistory.undo());
				await waitForItemEvent('trash');
				assert.equal(win.Zotero_Tabs.selectedID, reader.tabID);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should select the library tab when undoing a library change from a reader', async function () {
			let reader;
			try {
				win.Zotero_Tabs.select('zotero-pane');
				let collection = await createDataObject('collection', { name: 'Original' });
				Zotero.UndoHistory.clear();
				collection.name = 'Modified';
				await collection.saveTx({ undoAction: 'undo-action-rename-collection' });

				let attachment = await importFileAttachment('test.pdf');
				reader = await Zotero.Reader.open(attachment.itemID);
				await reader._initPromise;
				assert.equal(win.Zotero_Tabs.selectedID, reader.tabID);

				assert.isTrue(await Zotero.UndoHistory.undo());
				assert.equal(collection.name, 'Original');
				assert.equal(win.Zotero_Tabs.selectedID, 'zotero-pane');
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should run undo commands from the app-wide history while a reader view has focus', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;
				Zotero.UndoHistory.clear();

				annotationManager.addAnnotation(
					Components.utils.cloneInto({
						type: 'highlight',
						color: '#ffd400',
						sortIndex: '00000|003305|00000',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 100, 100]]
						},
						text: 'test'
					}, reader._iframeWindow)
				);
				await waitForItemEvent('add');

				await reader.focus();
				await Zotero.Promise.delay(100);
				// Focus only moves into the reader while its window is active.
				// It lands in a view iframe, whose frame tree is rooted at the
				// reader itself.
				if (win.document.commandDispatcher.focusedWindow?.top !== reader._iframeWindow) {
					Zotero.debug("Skipping test -- reader couldn't be focused");
					this.skip();
				}

				assert.isFalse(Zotero.UndoHistory.hasNativeUndo(win.document));
				// As the Edit menu and key_undo do
				win.goDoCommand('cmd_undo');
				await waitForItemEvent('trash');
				assert.lengthOf(attachment.getAnnotations(), 0);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should leave undo to text editing while a reader text box has focus', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				await reader._internalReader._primaryView.initializedPromise;
				let doc = reader._iframeWindow.document;
				let pageNumberInput = doc.getElementById('pageNumber');
				pageNumberInput.focus();
				await Zotero.Promise.delay(100);
				// Focus only moves into the reader while its window is active
				if (win.document.commandDispatcher.focusedWindow !== reader._iframeWindow
						|| doc.activeElement !== pageNumberInput) {
					Zotero.debug("Skipping test -- reader text box couldn't be focused");
					this.skip();
				}

				assert.isTrue(Zotero.UndoHistory.hasNativeUndo(win.document));
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should reopen a reader whose tab closes during a notifier transaction', async function () {
			let reader, reopenedReader;
			let title = Zotero.Promise.defer();
			let updates = [];
			let sandbox = sinon.createSandbox();
			let transactionOpen = false;

			try {
				let attachment = await importFileAttachment('test.pdf');
				reader = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				let oldTabContainer = win.document.getElementById(reader.tabID);
				sandbox.stub(attachment, 'getTabTitle').returns(title.promise);
				let updateTitleSpy = sandbox.spy(reader, 'updateTitle');
				let setTitleSpy = sandbox.spy(reader, '_setTitleValue');
				let disposeSpy = sandbox.spy(reader._blockingObserver, 'dispose');
				updates.push(reader.updateTitle());

				Zotero.Notifier.begin();
				transactionOpen = true;
				win.Zotero_Tabs.close(reader.tabID);
				await waitForCallback(() => !oldTabContainer.isConnected, 10, 5);
				assert.isTrue(reader._isTabClosed);
				sinon.assert.calledOnce(disposeSpy);
				assert.isNull(reader._blockingObserver);
				Zotero.Reader.notify('modify', 'item', [attachment.id], {});
				updates.push(...updateTitleSpy.getCalls().slice(1).map(call => call.returnValue));
				assert.equal(updateTitleSpy.callCount, 2);

				reopenedReader = await Zotero.Reader.open(attachment.id);
				assert.notStrictEqual(reopenedReader, reader);

				title.resolve('Stale title');
				await Promise.all(updates);
				sinon.assert.notCalled(setTitleSpy);
				await reopenedReader._initPromise;

				await Zotero.Notifier.commit();
				transactionOpen = false;
				assert.isFalse(Zotero.Reader._readers.includes(reader));
			}
			finally {
				title.resolve('Stale title');
				try {
					await Promise.all(updates);
				}
				catch {}
				sandbox.restore();
				if (transactionOpen) Zotero.Notifier.reset();
				await cleanupReaders(reader, reopenedReader);
			}
		});

		it('should reuse a queued unloaded reader tab and preserve its close callback', async function () {
			let reader, reloadedReader, openResult, tabID, unloadedTab;
			let closeCalls = 0, callbackHadExpectedReceiver, callbackSawOpenReader;
			let transactionOpen = false;

			try {
				let attachment = await importFileAttachment('test.pdf');
				reader = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				tabID = reader.tabID;
				let oldTabContainer = win.document.getElementById(tabID);
				win.Zotero_Tabs.select('zotero-pane');
				Zotero.Notifier.begin();
				transactionOpen = true;
				win.Zotero_Tabs.unload(tabID);
				await waitForCallback(() => !oldTabContainer.isConnected, 10, 5);
				unloadedTab = win.Zotero_Tabs._getTab(tabID).tab;
				unloadedTab.onClose = function () {
					closeCalls++;
					callbackHadExpectedReceiver = this === unloadedTab;
					callbackSawOpenReader = reloadedReader && !reloadedReader._isTabClosed;
				};

				openResult = await Zotero.Reader.open(attachment.id);
				assert.isTrue(openResult === undefined, 'should select the unloaded tab');
				reloadedReader = await waitForCallback(
					() => Zotero.Reader._readers.find(r => r !== reader && r.tabID === tabID),
					50, 5
				);
				await reloadedReader._initPromise;

				await Zotero.Notifier.commit();
				transactionOpen = false;
				assert.strictEqual(Zotero.Reader.getByTabID(tabID), reloadedReader);

				win.Zotero_Tabs.close(tabID);
				await waitForCallback(
					() => !Zotero.Reader._readers.includes(reloadedReader), 10, 5);
				assert.equal(closeCalls, 1);
				assert.isTrue(callbackHadExpectedReceiver);
				assert.isTrue(callbackSawOpenReader);
				assert.isTrue(reloadedReader._isTabClosed);
			}
			finally {
				if (transactionOpen) Zotero.Notifier.reset();
				let tab = tabID && win.Zotero_Tabs._getTab(tabID).tab;
				if (tab) tab.onClose = null;
				if (tab) win.Zotero_Tabs.close(tabID);
				await cleanupReaders(reader, reloadedReader, openResult);
			}
		});

		it('should open a reader window while a closed tab reader is pending', async function () {
			let reader, windowReader, unloadedTabID;
			let transactionOpen = false;

			try {
				let attachment = await importFileAttachment('test.pdf');
				reader = await Zotero.Reader.open(attachment.id);
				await reader._initPromise;
				({ id: unloadedTabID } = win.Zotero_Tabs.add({
					type: 'reader-unloaded',
					data: { itemID: attachment.id },
				}));
				Zotero.Notifier.begin();
				transactionOpen = true;
				win.Zotero_Tabs.close(reader.tabID);

				windowReader = await Zotero.Reader.open(
					attachment.id, null, { openInWindow: true });
				await windowReader._initPromise;
				assert.equal(win.Zotero_Tabs._getTab(unloadedTabID).tab.type, 'reader-unloaded');

				await Zotero.Notifier.commit();
				transactionOpen = false;
			}
			finally {
				if (transactionOpen) Zotero.Notifier.reset();
				if (win.Zotero_Tabs._getTab(unloadedTabID).tab) {
					win.Zotero_Tabs.close(unloadedTabID);
				}
				await cleanupReaders(reader, windowReader);
			}
		});

		it('should name the undone action in a reader window Edit menu', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let reader = await Zotero.Reader.open(attachment.id, null, { openInWindow: true });
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;
				Zotero.UndoHistory.clear();

				annotationManager.addAnnotation(
					Components.utils.cloneInto({
						type: 'highlight',
						color: '#ffd400',
						sortIndex: '00000|003305|00000',
						position: {
							pageIndex: 0,
							rects: [[0, 0, 100, 100]]
						},
						text: 'test'
					}, reader._iframeWindow)
				);
				await waitForItemEvent('add');

				let doc = reader._window.document;
				Zotero.UndoHistory.updateMenuItems(doc);
				let undoItem = doc.getElementById('menu_undo');
				assert.isFalse(undoItem.hasAttribute('data-l10n-id'));
				assert.equal(
					undoItem.getAttribute('label'),
					Zotero.ftl.formatValueSync('menu-edit-undo-action', {
						action: Zotero.ftl.formatValueSync('undo-action-add-annotation', { count: 1 })
					})
				);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should trash annotation deleted in the reader and restore it on reader undo', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let highlight = await createAnnotation('highlight', attachment);
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;

				// Delete annotation from the reader
				annotationManager.deleteAnnotations(
					Components.utils.cloneInto([highlight.key], reader._iframeWindow)
				);
				await waitForItemEvent('trash');

				// The item is trashed, not erased, and removed from the reader
				assert.isTrue(highlight.deleted);
				assert.notInclude(annotationManager._annotations.map(x => x.id), highlight.key);

				// Undoing in the reader restores the same item from the trash
				annotationManager.undo();
				await waitForItemEvent('modify');
				assert.isFalse(highlight.deleted);
				assert.include(annotationManager._annotations.map(x => x.id), highlight.key);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should restore annotation trashed in the reader when undoing from the library', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let highlight = await createAnnotation('highlight', attachment);
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;
				Zotero.UndoHistory.clear();

				annotationManager.deleteAnnotations(
					Components.utils.cloneInto([highlight.key], reader._iframeWindow)
				);
				await waitForItemEvent('trash');
				assert.isTrue(highlight.deleted);

				// The reader's delete step is mirrored into the app-wide history
				// as a single entry
				assert.equal(
					Zotero.UndoHistory.getUndoAction().action, 'undo-action-trash-annotation'
				);
				assert.isTrue(await Zotero.UndoHistory.undo());
				await waitForItemEvent('modify');
				assert.isFalse(highlight.deleted);
				assert.isFalse(Zotero.UndoHistory.canUndo());
				assert.include(annotationManager._annotations.map(x => x.id), highlight.key);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should remove annotation from the reader when trashed from the library', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let highlight = await createAnnotation('highlight', attachment);
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				assert.include(annotationManager._annotations.map(x => x.id), highlight.key);

				await Zotero.Items.trashTx([highlight.id]);

				assert.notInclude(annotationManager._annotations.map(x => x.id), highlight.key);
				assert.notInclude(reader.annotationItemIDs, highlight.id);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should re-add annotation to the reader when restored from the trash', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let highlight = await createAnnotation('highlight', attachment);
			highlight.deleted = true;
			await highlight.saveTx();

			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				// Trashed annotations aren't loaded
				assert.notInclude(annotationManager._annotations.map(x => x.id), highlight.key);

				highlight.deleted = false;
				await highlight.saveTx();

				// setAnnotations() conversion is async, so poll for the row to appear
				await waitForCallback(
					() => annotationManager._annotations.map(x => x.id).includes(highlight.key),
					50, 3
				);
				assert.include(reader.annotationItemIDs, highlight.id);
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		it('should not restore annotation from reader history after it is erased from the trash', async function () {
			let attachment = await importFileAttachment('test.pdf');
			let highlight = await createAnnotation('highlight', attachment);
			let reader = await Zotero.Reader.open(attachment.itemID);
			try {
				await reader._initPromise;
				let annotationManager = reader._internalReader._annotationManager;
				annotationManager._skipAnnotationSavingDebounce = true;

				// Trash from the reader, leaving a delete point in its history
				annotationManager.deleteAnnotations(
					Components.utils.cloneInto([highlight.key], reader._iframeWindow)
				);
				await waitForItemEvent('trash');
				assert.isTrue(annotationManager.canUndo);

				// Permanently delete from the trash
				await Zotero.Items.erase([highlight.id]);

				// The reader history points referencing the annotation are dropped,
				// so it can't be recreated with the same key
				assert.isFalse(annotationManager.canUndo);
				assert.isFalse(Zotero.Items.getByLibraryAndKey(attachment.libraryID, highlight.key));
			}
			finally {
				await cleanupReaders(reader);
			}
		});

		describe("#importFromEPUB()", function () {
			let bookEpubPath; // The EPUB itself
			let bookSdrPath; // The KOReader "sidecar" folder
			let calibreBookmarksPath; // The calibre_bookmarks.txt file (we'll copy this into META_INF for some tests)
			let metadataOpfPath; // The Calibre metadata.opf file

			let tempPath;
			let tempBookEpubPath;

			async function waitForReader(reader) {
				await reader._initPromise;
				// Shouldn't this just be included in _initPromise?
				await reader._internalReader._primaryView.initializedPromise;
			}
			
			async function waitForAdds(n) {
				while (n > 0) {
					n -= (await waitForItemEvent('add')).length;
				}
			}
			
			before(function () {
				bookEpubPath = getTestDataDirectory();
				bookEpubPath.append('moby_dick');
				bookEpubPath.append('book.epub');
				bookEpubPath = bookEpubPath.path;
				
				calibreBookmarksPath = getTestDataDirectory();
				calibreBookmarksPath.append('moby_dick');
				calibreBookmarksPath.append('calibre_bookmarks.txt');
				calibreBookmarksPath = calibreBookmarksPath.path;

				metadataOpfPath = getTestDataDirectory();
				metadataOpfPath.append('moby_dick');
				metadataOpfPath.append('metadata.opf');
				metadataOpfPath = metadataOpfPath.path;

				bookSdrPath = getTestDataDirectory();
				bookSdrPath.append('moby_dick');
				bookSdrPath.append('book.sdr');
				bookSdrPath = bookSdrPath.path;
			});
			
			beforeEach(async function () {
				tempPath = await getTempDirectory();
				tempBookEpubPath = PathUtils.join(tempPath, 'book.epub');
				await IOUtils.copy(bookEpubPath, tempBookEpubPath);
			});
			
			it("should import EPUB annotations from KOReader (stored alongside EPUB)", async function () {
				await IOUtils.copy(bookSdrPath, PathUtils.join(tempPath, 'book.sdr'), { recursive: true });
				
				let attachment = await Zotero.Attachments.linkFromFile({ file: tempBookEpubPath });
				let reader = await Zotero.Reader.open(attachment.id);
				await waitForReader(reader);
				
				let donePromise = Promise.all([waitForDialog(), waitForAdds(2)]);
				await reader.importFromEPUB();
				await donePromise;
				
				assert.equal(attachment.getAnnotations().length, 2);
			});
			
			it("should import EPUB annotations from KOReader (stored elsewhere)", async function () {
				let attachment = await Zotero.Attachments.linkFromFile({ file: tempBookEpubPath });
				let reader = await Zotero.Reader.open(attachment.id);
				await waitForReader(reader);

				let donePromise = Promise.all([waitForDialog(), waitForAdds(2)]);
				// Import annotations from the *original* EPUB (alongside its book.sdr/metadata.epub.lua)
				await reader.importFromEPUB(bookEpubPath);
				await donePromise;
				
				assert.equal(attachment.getAnnotations().length, 2);
			});

			it("should import EPUB annotations from Calibre (stored alongside EPUB)", async function () {
				await IOUtils.copy(metadataOpfPath, PathUtils.join(tempPath, 'metadata.opf'));

				let attachment = await Zotero.Attachments.linkFromFile({ file: tempBookEpubPath });
				let reader = await Zotero.Reader.open(attachment.id);
				await waitForReader(reader);

				let donePromise = Promise.all([waitForDialog(), waitForAdds(2)]);
				await reader.importFromEPUB();
				await donePromise;

				assert.equal(attachment.getAnnotations().length, 2);
			});

			it("should import EPUB annotations from Calibre (stored within EPUB)", async function () {
				let zipWriter = Cc['@mozilla.org/zipwriter;1'].createInstance(Ci.nsIZipWriter);
				zipWriter.open(Zotero.File.pathToFile(tempBookEpubPath), 0x04 /* RDWR */);
				zipWriter.addEntryFile(
					'META-INF/calibre_bookmarks.txt',
					Ci.nsIZipWriter.COMPRESSION_DEFAULT,
					Zotero.File.pathToFile(calibreBookmarksPath),
					false,
				);
				zipWriter.close();
				
				let attachment = await Zotero.Attachments.linkFromFile({ file: tempBookEpubPath });
				let reader = await Zotero.Reader.open(attachment.id);
				await waitForReader(reader);

				let donePromise = Promise.all([waitForDialog(), waitForAdds(2)]);
				await reader.importFromEPUB();
				await donePromise;

				assert.equal(attachment.getAnnotations().length, 2);
			});
		});
	});
});
