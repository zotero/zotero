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
