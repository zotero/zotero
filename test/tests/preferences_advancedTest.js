describe("Advanced Preferences", function () {
	describe("Files & Folders", function () {
		describe("Linked Attachment Base Directory", function () {
			var setBaseDirectory = async function (basePath) {
				var win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
					pane: 'zotero-prefpane-advanced'
				});
				
				// Wait for tab to load
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				
				var promise = waitForDialog();
				await win.Zotero_Preferences.Attachment_Base_Directory.changePath(basePath);
				await promise;
				
				win.close();
			};
			
			var clearBaseDirectory = async function (basePath) {
				var win = await loadWindow("chrome://zotero/content/preferences/preferences.xhtml", {
					pane: 'zotero-prefpane-advanced',
					tabIndex: 1
				});
				
				// Wait for tab to load
				await win.Zotero_Preferences.waitForFirstPaneLoad();
				
				var promise = waitForDialog();
				await win.Zotero_Preferences.Attachment_Base_Directory.clearPath();
				await promise;
				
				win.close();
			};
			
			beforeEach(function () {
				Zotero.Prefs.clear('baseAttachmentPath');
				Zotero.Prefs.clear('saveRelativeAttachmentPath');
			});
			
			it("should set new base directory", async function () {
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), basePath);
				assert.isTrue(Zotero.Prefs.get('saveRelativeAttachmentPath'));
			})
			
			it("should clear base directory", async function () {
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				await clearBaseDirectory();
				
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), '');
				assert.isFalse(Zotero.Prefs.get('saveRelativeAttachmentPath'));
			})
			
			it("should change absolute path of linked attachment under new base dir to prefixed path", async function () {
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = await Zotero.Attachments.linkFromFile({ file });
				assert.equal(attachment.attachmentPath, file.path);
				
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
			})
			
			it("should change prefixed path to absolute when changing base directory", async function () {
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = await Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
				
				// Choose a nonexistent directory for the base path
				var otherPath = OS.Path.join(OS.Path.dirname(basePath), 'foobar');
				await setBaseDirectory(otherPath);
				
				assert.equal(attachment.attachmentPath, file.path);
			})
			
			it("should change prefixed path to absolute when clearing base directory", async function () {
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = await Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
				
				await clearBaseDirectory();
				
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), '');
				assert.isFalse(Zotero.Prefs.get('saveRelativeAttachmentPath'));
				
				assert.equal(attachment.attachmentPath, file.path);
			});
			
			it("should ignore attachment with relative path already within new base directory", async function () {
				var file = getTestDataDirectory();
				file.append('test.png');
				file = file.path;
				
				var attachment = await Zotero.Attachments.linkFromFile({ file });
				assert.equal(attachment.attachmentPath, file);
				
				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);
				
				var newBasePath = await getTempDirectory();
				await IOUtils.copy(file, PathUtils.joinRelative(newBasePath, 'test.png'));
				
				await setBaseDirectory(newBasePath);
				
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
			});

			it("should ignore attachment with invalid relative path", async function () {
				var file = getTestDataDirectory();
				file.append('test.pdf');
				file = file.path;
				
				var attachment = createUnsavedDataObject('item', { itemType: 'attachment' });
				attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_FILE;
				attachment.attachmentPath = 'attachments:/test.pdf'; // Invalid
				await attachment.saveTx();

				var basePath = getTestDataDirectory().path;
				await setBaseDirectory(basePath);

				var newBasePath = await getTempDirectory();
				await IOUtils.copy(file, PathUtils.joinRelative(newBasePath, 'test.pdf'));

				await setBaseDirectory(newBasePath);

				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + '/test.pdf'
				);
			});
		})
	})
})
