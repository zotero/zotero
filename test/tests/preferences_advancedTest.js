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
			var setBaseDirectory = Zotero.Promise.coroutine(function* (basePath) {
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
				yield win.Zotero_Preferences.Attachment_Base_Directory.changePath(basePath);
				yield promise;
				
				win.close();
			});
			
			var clearBaseDirectory = Zotero.Promise.coroutine(function* (basePath) {
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
				yield win.Zotero_Preferences.Attachment_Base_Directory.clearPath();
				yield promise;
				
				win.close();
			});
			
			beforeEach(function () {
				Zotero.Prefs.clear('baseAttachmentPath');
				Zotero.Prefs.clear('saveRelativeAttachmentPath');
			});
			
			it("should set new base directory", function* () {
				var basePath = getTestDataDirectory().path;
				yield setBaseDirectory(basePath);
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), basePath);
				assert.isTrue(Zotero.Prefs.get('saveRelativeAttachmentPath'));
			})
			
			it("should clear base directory", function* () {
				var basePath = getTestDataDirectory().path;
				yield setBaseDirectory(basePath);
				yield clearBaseDirectory();
				
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), '');
				assert.isFalse(Zotero.Prefs.get('saveRelativeAttachmentPath'));
			})
			
			it("should change absolute path of linked attachment under new base dir to prefixed path", function* () {
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(attachment.attachmentPath, file.path);
				
				var basePath = getTestDataDirectory().path;
				yield setBaseDirectory(basePath);
				
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
			})
			
			it("should change prefixed path to absolute when changing base directory", function* () {
				var basePath = getTestDataDirectory().path;
				yield setBaseDirectory(basePath);
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
				
				var basePath = Zotero.getTempDirectory().path;
				yield setBaseDirectory(basePath);
				
				assert.equal(attachment.attachmentPath, file.path);
			})
			
			it("should change prefixed path to absolute when clearing base directory", function* () {
				var basePath = getTestDataDirectory().path;
				yield setBaseDirectory(basePath);
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.linkFromFile({ file });
				assert.equal(
					attachment.attachmentPath,
					Zotero.Attachments.BASE_PATH_PLACEHOLDER + 'test.png'
				);
				
				yield clearBaseDirectory();
				
				assert.equal(Zotero.Prefs.get('baseAttachmentPath'), '');
				assert.isFalse(Zotero.Prefs.get('saveRelativeAttachmentPath'));
				
				assert.equal(attachment.attachmentPath, file.path);
			})
		})
	})
})
