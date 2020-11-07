describe("Advanced Preferences", function () {
	// TODO: Debug output logging is now in the application menus, and we test in Firefox...
	// Maybe add the debug output menu to Firefox for the purposes of testing?
	describe.skip("General", function () {
		var server;
		
		before(function () {
			server = sinon.fakeServer.create();
			server.autoRespond = true;
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		});
		
		after(function () {
			Zotero.HTTP.mock = null;
		})
		
		describe("Debug Output", function () {
			it("should log output and submit to server", function* () {
				var win = yield loadWindow("chrome://zotero/content/preferences/preferences.xul", {
					pane: 'zotero-prefpane-advanced',
					tabIndex: 0
				});
				
				// Wait for tab to load
				var doc = win.document;
				var prefwindow = doc.documentElement;
				var defer = Zotero.Promise.defer();
				var pane = doc.getElementById('zotero-prefpane-advanced');
				if (!pane.loaded) {
					pane.addEventListener('paneload', function () {
						defer.resolve();
					})
					yield defer.promise;
				}
				
				var enableButton = doc.getElementById('debug-output-enable');
				enableButton.click();
				yield createDataObject('item');
				enableButton.click();
				
				server.respond(function (req) {
					if (req.method == "POST") {
						req.respond(
							200,
							{},
							'<?xml version="1.0" encoding="UTF-8"?>\n'
								+ '<xml><reported reportID="1234567890"/></xml>'
						);
					}
				});
				
				// Make sure Debug ID is shown in dialog
				var promise = waitForDialog(function (dialog) {
					assert.match(dialog.document.documentElement.textContent, /D1234567890/);
				});
				doc.getElementById('debug-output-submit').click();
				yield promise;
				
				win.close();
			});
		});
	});
	
	describe("Files & Folders", function () {
		describe("Linked Attachment Base Directory", function () {
			var setBaseDirectory = Zotero.Promise.coroutine(function* (baseDir) {
				var win = yield loadWindow("chrome://zotero/content/preferences/preferences.xul", {
					pane: 'zotero-prefpane-advanced',
					tabIndex: 1
				});
				
				// Wait for tab to load
				var doc = win.document;
				var prefwindow = doc.documentElement;
				var defer = Zotero.Promise.defer();
				var pane = doc.getElementById('zotero-prefpane-advanced');
				if (!pane.loaded) {
					pane.addEventListener('paneload', function () {
						defer.resolve();
					})
					yield defer.promise;
				}
				
				var promise = waitForDialog();
				yield win.Zotero_Preferences.Attachment_Base_Directory.changeBaseDirByLibrary(Zotero.Libraries.userLibraryID, baseDir);
				yield promise;
				
				win.close();
			});
			
			var clearBaseDirectory = Zotero.Promise.coroutine(function* (baseDir) {
				var win = yield loadWindow("chrome://zotero/content/preferences/preferences.xul", {
					pane: 'zotero-prefpane-advanced',
					tabIndex: 1
				});
				
				// Wait for tab to load
				var doc = win.document;
				var prefwindow = doc.documentElement;
				var defer = Zotero.Promise.defer();
				var pane = doc.getElementById('zotero-prefpane-advanced');
				if (!pane.loaded) {
					pane.addEventListener('paneload', function () {
						defer.resolve();
					})
					yield defer.promise;
				}

				var promise = waitForDialog();
				yield win.Zotero_Preferences.Attachment_Base_Directory.clearBaseDirByLibrary(Zotero.Libraries.userLibraryID);
				yield promise;

				win.close();
			});

			beforeEach(function () {
				Zotero.Prefs.clear('libraryAttachmentBaseDirs');
				Zotero.Prefs.clear('librarySaveRelativeAttachmentPaths');
			});

			it("should set new base directory", function* () {
				var baseDir = getTestDataDirectory().path;
				yield setBaseDirectory(baseDir);
				assert.equal(Zotero.Attachments.getBaseDirByLibrary(Zotero.Libraries.userLibraryID), baseDir);
				assert.isTrue(Zotero.Attachments.getSaveRelativePathByLibrary(Zotero.Libraries.userLibraryID));
			})

			it("should clear base directory", function* () {
				var baseDir = getTestDataDirectory().path;
				yield setBaseDirectory(baseDir);
				yield clearBaseDirectory();

				assert.equal(Zotero.Attachments.getBaseDirByLibrary(Zotero.Libraries.userLibraryID), '');
				assert.isFalse(Zotero.Attachments.getSaveRelativePathByLibrary(Zotero.Libraries.userLibraryID));
			})

			it("should change absolute path of linked attachment under new base dir to prefixed path", function* () {
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(attachment.attachmentPath, file.path);

				var baseDir = getTestDataDirectory().path;
				yield setBaseDirectory(baseDir);

				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
			})

			it("should change prefixed path to absolute when changing base directory", function* () {
				var baseDir = getTestDataDirectory().path;
				yield setBaseDirectory(baseDir);

				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
				
				// Choose a nonexistent directory for the base directory
				var baseDir = OS.Path.join(OS.Path.dirname(baseDir), 'foobar');
				yield setBaseDirectory(baseDir);
				
				assert.equal(attachment.attachmentPath, file.path);
			})

			it("should change prefixed path to absolute when clearing base directory", function* () {
				var baseDir = getTestDataDirectory().path;
				yield setBaseDirectory(baseDir);

				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);

				yield clearBaseDirectory();

				assert.equal(Zotero.Attachments.getBaseDirByLibrary(Zotero.Libraries.userLibraryID), '');
				assert.isFalse(Zotero.Attachments.getSaveRelativePathByLibrary(Zotero.Libraries.userLibraryID));

				assert.equal(attachment.attachmentPath, file.path);
			})
		})
	})
})
