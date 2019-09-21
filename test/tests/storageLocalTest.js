"use strict";

describe("Zotero.Sync.Storage.Local", function () {
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		})
	})
	
	
	describe("#checkForUpdatedFiles()", function () {
		it("should flag modified file for upload and return it", function* () {
			// Create attachment
			let item = yield importTextAttachment();
			var hash = yield item.attachmentHash;
			// Set file mtime to the past (without milliseconds, which aren't used on OS X)
			var mtime = (Math.floor(new Date().getTime() / 1000) * 1000) - 1000;
			yield OS.File.setDates((yield item.getFilePathAsync()), null, mtime);
			
			// Mark as synced, so it will be checked
			item.attachmentSyncedModificationTime = mtime;
			item.attachmentSyncedHash = hash;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			
			// Update mtime and contents
			var path = yield item.getFilePathAsync();
			yield OS.File.setDates(path);
			yield Zotero.File.putContentsAsync(path, Zotero.Utilities.randomString());
			
			// File should be returned
			var libraryID = Zotero.Libraries.userLibraryID;
			var changed = yield Zotero.Sync.Storage.Local.checkForUpdatedFiles(libraryID);
			
			yield item.eraseTx();
			
			assert.equal(changed, true);
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD);
		})
		
		it("should skip a file if mod time hasn't changed", function* () {
			// Create attachment
			let item = yield importTextAttachment();
			var hash = yield item.attachmentHash;
			var mtime = yield item.attachmentModificationTime;
			
			// Mark as synced, so it will be checked
			item.attachmentSyncedModificationTime = mtime;
			item.attachmentSyncedHash = hash;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var changed = yield Zotero.Sync.Storage.Local.checkForUpdatedFiles(libraryID);
			var syncState = item.attachmentSyncState;
			
			yield item.eraseTx();
			
			assert.isFalse(changed);
			assert.equal(syncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC);
		})
		
		it("should skip a file if mod time has changed but contents haven't", function* () {
			// Create attachment
			let item = yield importTextAttachment();
			var hash = yield item.attachmentHash;
			// Set file mtime to the past (without milliseconds, which aren't used on OS X)
			var mtime = (Math.floor(new Date().getTime() / 1000) * 1000) - 1000;
			yield OS.File.setDates((yield item.getFilePathAsync()), null, mtime);
			
			// Mark as synced, so it will be checked
			item.attachmentSyncedModificationTime = mtime;
			item.attachmentSyncedHash = hash;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			
			// Update mtime, but not contents
			var path = yield item.getFilePathAsync();
			yield OS.File.setDates(path);
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var changed = yield Zotero.Sync.Storage.Local.checkForUpdatedFiles(libraryID);
			var syncState = item.attachmentSyncState;
			var syncedModTime = item.attachmentSyncedModificationTime;
			var newModTime = yield item.attachmentModificationTime;
			
			yield item.eraseTx();
			
			assert.isFalse(changed);
			assert.equal(syncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC);
			assert.equal(syncedModTime, newModTime);
		})
	})
	
	describe("#updateSyncStates()", function () {
		it("should update attachment sync states to 'to_upload'", function* () {
			var attachment1 = yield importFileAttachment('test.png');
			attachment1.attachmentSyncState = 'in_sync';
			yield attachment1.saveTx();
			var attachment2 = yield importFileAttachment('test.png');
			attachment2.attachmentSyncState = 'in_sync';
			yield attachment2.saveTx();
			
			var local = Zotero.Sync.Storage.Local;
			yield local.updateSyncStates([attachment1, attachment2], 'to_upload');
			
			for (let attachment of [attachment1, attachment2]) {
				assert.strictEqual(attachment.attachmentSyncState, local.SYNC_STATE_TO_UPLOAD);
				let state = yield Zotero.DB.valueQueryAsync(
					"SELECT syncState FROM itemAttachments WHERE itemID=?", attachment.id
				);
				assert.strictEqual(state, local.SYNC_STATE_TO_UPLOAD);
			}
		});
	});
	
	describe("#resetAllSyncStates()", function () {
		it("should reset attachment sync states to 'to_upload'", function* () {
			var attachment = yield importFileAttachment('test.png');
			attachment.attachmentSyncState = 'in_sync';
			yield attachment.saveTx();
			
			var local = Zotero.Sync.Storage.Local;
			yield local.resetAllSyncStates(attachment.libraryID)
			assert.strictEqual(attachment.attachmentSyncState, local.SYNC_STATE_TO_UPLOAD);
			var state = yield Zotero.DB.valueQueryAsync(
				"SELECT syncState FROM itemAttachments WHERE itemID=?", attachment.id
			);
			assert.strictEqual(state, local.SYNC_STATE_TO_UPLOAD);
		});
	});
	
	describe("#processDownload()", function () {
		describe("single file", function () {
			it("should download a single file into the attachment directory", function* () {
				var libraryID = Zotero.Libraries.userLibraryID;
				var parentItem = yield createDataObject('item');
				var key = Zotero.DataObjectUtilities.generateKey();
				var fileContents = Zotero.Utilities.randomString();
				
				var oldFilename = "Old File";
				var tmpDir = Zotero.getTempDirectory().path;
				var tmpFile = OS.Path.join(tmpDir, key + '.tmp');
				yield Zotero.File.putContentsAsync(tmpFile, fileContents);
				
				// Create an existing attachment directory to replace
				var dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(libraryID, key).path;
				yield OS.File.makeDir(
					dir,
					{
						unixMode: 0o755
					}
				);
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, oldFilename), '');
				
				var md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(tmpFile));
				var mtime = 1445667239000;
				
				var json = {
					key,
					version: 10,
					itemType: 'attachment',
					linkMode: 'imported_url',
					url: 'https://example.com/foo.txt',
					filename: 'foo.txt',
					contentType: 'text/plain',
					charset: 'utf-8',
					md5,
					mtime
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, [json]);
				
				var item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				yield Zotero.Sync.Storage.Local.processDownload({
					item,
					md5,
					mtime
				});
				yield OS.File.remove(tmpFile);
				
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				
				// Make sure previous files don't exist
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, oldFilename)));
				
				// Make sure main file matches attachment hash and mtime
				yield assert.eventually.equal(
					item.attachmentHash, Zotero.Utilities.Internal.md5(fileContents)
				);
				yield assert.eventually.equal(item.attachmentModificationTime, mtime);
			});
			
			
			it("should download and rename a single file with invalid filename into the attachment directory", function* () {
				var libraryID = Zotero.Libraries.userLibraryID;
				var parentItem = yield createDataObject('item');
				var key = Zotero.DataObjectUtilities.generateKey();
				var fileContents = Zotero.Utilities.randomString();
				
				var oldFilename = "Old File";
				var newFilename = " ab — c \\:.txt.";
				var filteredFilename = " ab — c .txt.";
				var tmpDir = Zotero.getTempDirectory().path;
				var tmpFile = OS.Path.join(tmpDir, key + '.tmp');
				yield Zotero.File.putContentsAsync(tmpFile, fileContents);
				
				// Create an existing attachment directory to replace
				var dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(libraryID, key).path;
				yield OS.File.makeDir(
					dir,
					{
						unixMode: 0o755
					}
				);
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, oldFilename), '');
				
				var md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(tmpFile));
				var mtime = 1445667239000;
				
				var json = {
					key,
					version: 10,
					itemType: 'attachment',
					linkMode: 'imported_url',
					url: 'https://example.com/foo.txt',
					filename: newFilename,
					contentType: 'text/plain',
					charset: 'utf-8',
					md5,
					mtime
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, [json]);
				
				var item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				yield Zotero.Sync.Storage.Local.processDownload({
					item,
					md5,
					mtime
				});
				yield OS.File.remove(tmpFile);
				
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				
				// Make sure previous file doesn't exist
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, oldFilename)));
				// And new one does
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, filteredFilename)));
				
				// Make sure main file matches attachment hash and mtime
				yield assert.eventually.equal(
					item.attachmentHash, Zotero.Utilities.Internal.md5(fileContents)
				);
				yield assert.eventually.equal(item.attachmentModificationTime, mtime);
			});
			
			
			it("should download and rename a single file with invalid filename using Windows parsing rules into the attachment directory", function* () {
				var libraryID = Zotero.Libraries.userLibraryID;
				var parentItem = yield createDataObject('item');
				var key = Zotero.DataObjectUtilities.generateKey();
				var fileContents = Zotero.Utilities.randomString();
				
				var oldFilename = "Old File";
				var newFilename = "a:b.txt";
				var filteredFilename = "ab.txt";
				var tmpDir = Zotero.getTempDirectory().path;
				var tmpFile = OS.Path.join(tmpDir, key + '.tmp');
				yield Zotero.File.putContentsAsync(tmpFile, fileContents);
				
				// Create an existing attachment directory to replace
				var dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(libraryID, key).path;
				yield OS.File.makeDir(
					dir,
					{
						unixMode: 0o755
					}
				);
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, oldFilename), '');
				
				var md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(tmpFile));
				var mtime = 1445667239000;
				
				var json = {
					key,
					version: 10,
					itemType: 'attachment',
					linkMode: 'imported_url',
					url: 'https://example.com/foo.txt',
					filename: 'a:b.txt',
					contentType: 'text/plain',
					charset: 'utf-8',
					md5,
					mtime
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, [json]);
				
				var item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				
				// Stub functions to simulate OS.Path.basename() behavior on Windows
				var basenameOrigFunc = OS.Path.basename.bind(OS.Path);
				var basenameStub = sinon.stub(OS.Path, "basename").callsFake((path) => {
					// Split on colon
					if (path.endsWith("a:b.txt")) {
						return "b.txt";
					}
					return basenameOrigFunc(path);
				});
				var pathToFileOrigFunc = Zotero.File.pathToFile.bind(Zotero.File);
				var pathToFileStub = sinon.stub(Zotero.File, "pathToFile").callsFake((path) => {
					if (path.includes(":")) {
						throw new Error("Path contains colon");
					}
					return pathToFileOrigFunc(path);
				});
				
				yield Zotero.Sync.Storage.Local.processDownload({
					item,
					md5,
					mtime
				});
				yield OS.File.remove(tmpFile);
				
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				
				basenameStub.restore();
				pathToFileStub.restore();
				
				// Make sure path is set correctly
				assert.equal(item.getFilePath(), OS.Path.join(storageDir, filteredFilename));
				// Make sure previous files don't exist
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, oldFilename)));
				// And new one does
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, filteredFilename)));
				
				// Make sure main file matches attachment hash and mtime
				yield assert.eventually.equal(
					item.attachmentHash, Zotero.Utilities.Internal.md5(fileContents)
				);
				yield assert.eventually.equal(item.attachmentModificationTime, mtime);
			});
		});
		
		describe("ZIP", function () {
			it("should download and extract a ZIP file into the attachment directory", function* () {
				var file1Name = 'index.html';
				var file1Contents = '<html><body>Test</body></html>';
				var file2Name = 'aux1.txt';
				var file2Contents = 'Test 1';
				var subDirName = 'sub';
				var file3Name = 'aux2';
				var file3Contents = 'Test 2';
				
				var libraryID = Zotero.Libraries.userLibraryID;
				var parentItem = yield createDataObject('item');
				var key = Zotero.DataObjectUtilities.generateKey();
				
				var tmpDir = Zotero.getTempDirectory().path;
				var zipFile = OS.Path.join(tmpDir, key + '.tmp');
				
				// Create ZIP file with subdirectory
				var tmpDir = Zotero.getTempDirectory().path;
				var zipDir = yield getTempDirectory();
				yield Zotero.File.putContentsAsync(OS.Path.join(zipDir, file1Name), file1Contents);
				yield Zotero.File.putContentsAsync(OS.Path.join(zipDir, file2Name), file2Contents);
				var subDir = OS.Path.join(zipDir, subDirName);
				yield OS.File.makeDir(subDir);
				yield Zotero.File.putContentsAsync(OS.Path.join(subDir, file3Name), file3Contents);
				yield Zotero.File.zipDirectory(zipDir, zipFile);
				yield removeDir(zipDir);
				
				// Create an existing attachment directory (and subdirectory) to replace
				var dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(libraryID, key).path;
				yield OS.File.makeDir(
					OS.Path.join(dir, 'subdir'),
					{
						from: Zotero.DataDirectory.dir,
						unixMode: 0o755
					}
				);
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, 'A'), '');
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, 'subdir', 'B'), '');
				
				var md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(zipFile));
				var mtime = 1445667239000;
				
				var json = {
					key,
					version: 10,
					itemType: 'attachment',
					linkMode: 'imported_url',
					url: 'https://example.com',
					filename: file1Name,
					contentType: 'text/html',
					charset: 'utf-8',
					md5,
					mtime
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, [json]);
				
				var item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				yield Zotero.Sync.Storage.Local.processDownload({
					item,
					md5,
					mtime,
					compressed: true
				});
				yield OS.File.remove(zipFile);
				
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				
				// Make sure previous files don't exist
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, 'A')));
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, 'subdir')));
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, 'subdir', 'B')));
				
				// Make sure main file matches attachment hash and mtime
				yield assert.eventually.equal(
					item.attachmentHash, Zotero.Utilities.Internal.md5(file1Contents)
				);
				yield assert.eventually.equal(item.attachmentModificationTime, mtime);
				
				// Check second file
				yield assert.eventually.equal(
					Zotero.File.getContentsAsync(OS.Path.join(storageDir, file2Name)),
					file2Contents
				);
				
				// Check subdirectory and file
				assert.isTrue((yield OS.File.stat(OS.Path.join(storageDir, subDirName))).isDir);
				yield assert.eventually.equal(
					Zotero.File.getContentsAsync(OS.Path.join(storageDir, subDirName, file3Name)),
					file3Contents
				);
			});
			
			
			it("should download and rename a ZIP file with invalid filename using Windows parsing rules into the attachment directory", function* () {
				var libraryID = Zotero.Libraries.userLibraryID;
				var parentItem = yield createDataObject('item');
				var key = Zotero.DataObjectUtilities.generateKey();
				
				var oldFilename = "Old File";
				var oldAuxFilename = "a.gif";
				var newFilename = "a:b.html";
				var fileContents = Zotero.Utilities.randomString();
				var newAuxFilename = "b.gif";
				var filteredFilename = "ab.html";
				var tmpDir = Zotero.getTempDirectory().path;
				var zipFile = OS.Path.join(tmpDir, key + '.tmp');
				
				// Create ZIP file
				var tmpDir = Zotero.getTempDirectory().path;
				var zipDir = yield getTempDirectory();
				yield Zotero.File.putContentsAsync(OS.Path.join(zipDir, newFilename), fileContents);
				yield Zotero.File.putContentsAsync(OS.Path.join(zipDir, newAuxFilename), '');
				yield Zotero.File.zipDirectory(zipDir, zipFile);
				yield removeDir(zipDir);
				
				// Create an existing attachment directory to replace
				var dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(libraryID, key).path;
				yield OS.File.makeDir(
					dir,
					{
						unixMode: 0o755
					}
				);
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, oldFilename), '');
				yield Zotero.File.putContentsAsync(OS.Path.join(dir, oldAuxFilename), '');
				
				var md5 = Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(zipFile));
				var mtime = 1445667239000;
				
				var json = {
					key,
					version: 10,
					itemType: 'attachment',
					linkMode: 'imported_url',
					url: 'https://example.com/foo.html',
					filename: 'a:b.html',
					contentType: 'text/plain',
					charset: 'utf-8',
					md5,
					mtime
				};
				yield Zotero.Sync.Data.Local.processObjectsFromJSON('item', libraryID, [json]);
				
				var item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				
				// Stub functions to simulate OS.Path.basename() behavior on Windows
				var basenameOrigFunc = OS.Path.basename.bind(OS.Path);
				var basenameStub = sinon.stub(OS.Path, "basename").callsFake((path) => {
					// Split on colon
					if (path.endsWith("a:b.html")) {
						return "b.html";
					}
					return basenameOrigFunc(path);
				});
				var pathToFileOrigFunc = Zotero.File.pathToFile.bind(Zotero.File);
				var pathToFileStub = sinon.stub(Zotero.File, "pathToFile").callsFake((path) => {
					if (path.includes(":")) {
						throw new Error("Path contains colon");
					}
					return pathToFileOrigFunc(path);
				});
				
				yield Zotero.Sync.Storage.Local.processDownload({
					item,
					md5,
					mtime,
					compressed: true
				});
				yield OS.File.remove(zipFile);
				
				var storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				
				basenameStub.restore();
				pathToFileStub.restore();
				
				// Make sure path is set correctly
				assert.equal(item.getFilePath(), OS.Path.join(storageDir, filteredFilename));
				// Make sure previous files don't exist
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, oldFilename)));
				assert.isFalse(yield OS.File.exists(OS.Path.join(storageDir, oldAuxFilename)));
				// And new ones do
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, filteredFilename)));
				assert.isTrue(yield OS.File.exists(OS.Path.join(storageDir, newAuxFilename)));
				
				// Make sure main file matches attachment hash and mtime
				yield assert.eventually.equal(
					item.attachmentHash, Zotero.Utilities.Internal.md5(fileContents)
				);
				yield assert.eventually.equal(item.attachmentModificationTime, mtime);
			});
		});
	})
	
	describe("#getConflicts()", function () {
		it("should return an array of objects for attachments in conflict", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var item1 = yield importFileAttachment('test.png');
			item1.version = 10;
			yield item1.saveTx();
			var item2 = yield importTextAttachment();
			var item3 = yield importHTMLAttachment();
			item3.version = 11;
			yield item3.saveTx();
			
			var json1 = item1.toJSON();
			var json3 = item3.toJSON();
			// Change remote mtimes
			// Round to nearest second because OS X doesn't support ms resolution
			var now = Math.round(new Date().getTime() / 1000) * 1000;
			json1.mtime = now - 10000;
			json3.mtime = now - 20000;
			yield Zotero.Sync.Data.Local.saveCacheObjects('item', libraryID, [json1, json3]);
			
			item1.attachmentSyncState = "in_conflict";
			yield item1.saveTx({ skipAll: true });
			item3.attachmentSyncState = "in_conflict";
			yield item3.saveTx({ skipAll: true });
			
			var conflicts = yield Zotero.Sync.Storage.Local.getConflicts(libraryID);
			assert.lengthOf(conflicts, 2);
			
			var item1Conflict = conflicts.find(x => x.left.key == item1.key);
			assert.equal(
				item1Conflict.left.dateModified,
				Zotero.Date.dateToISO(new Date(yield item1.attachmentModificationTime))
			);
			assert.equal(
				item1Conflict.right.dateModified,
				Zotero.Date.dateToISO(new Date(json1.mtime))
			);
			
			var item3Conflict = conflicts.find(x => x.left.key == item3.key);
			assert.equal(
				item3Conflict.left.dateModified,
				Zotero.Date.dateToISO(new Date(yield item3.attachmentModificationTime))
			);
			assert.equal(
				item3Conflict.right.dateModified,
				Zotero.Date.dateToISO(new Date(json3.mtime))
			);
		})
	})
	
	describe("#resolveConflicts()", function () {
		var win;
		
		before(function* () {
			win = yield loadBrowserWindow();
		});
		
		after(function () {
			if (win) {
				win.close();
			}
		});
		
		
		it("should show the conflict resolution window on attachment conflicts", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var item1 = yield importFileAttachment('test.png');
			item1.version = 10;
			yield item1.saveTx();
			var item2 = yield importTextAttachment();
			var item3 = yield importHTMLAttachment();
			item3.version = 11;
			yield item3.saveTx();
			
			var json1 = item1.toJSON();
			var json3 = item3.toJSON();
			// Change remote mtimes and hashes
			json1.mtime = new Date().getTime() + 10000;
			json1.md5 = 'f4ce1167f3a854896c257a0cc1ac387f';
			json3.mtime = new Date().getTime() - 10000;
			json3.md5 = 'fcd080b1c2cad562237823ec27671bbd';
			yield Zotero.Sync.Data.Local.saveCacheObjects('item', libraryID, [json1, json3]);
			
			item1.attachmentSyncState = "in_conflict";
			yield item1.saveTx({ skipAll: true });
			item3.attachmentSyncState = "in_conflict";
			yield item3.saveTx({ skipAll: true });
			
			var promise = waitForWindow('chrome://zotero/content/merge.xul', function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// 1 (remote)
				// Later remote version should be selected
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				
				// Check checkbox text
				assert.equal(
					doc.getElementById('resolve-all').label,
					Zotero.getString('sync.conflict.resolveAllRemote')
				);
				
				// Select local object
				mergeGroup.leftpane.click();
				assert.equal(mergeGroup.leftpane.getAttribute('selected'), 'true');
				
				wizard.getButton('next').click();
				
				// 2 (local)
				// Later local version should be selected
				assert.equal(mergeGroup.leftpane.getAttribute('selected'), 'true');
				// Select remote object
				mergeGroup.rightpane.click();
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				
				if (Zotero.isMac) {
					assert.isTrue(wizard.getButton('next').hidden);
					assert.isFalse(wizard.getButton('finish').hidden);
				}
				else {
					// TODO
				}
				wizard.getButton('finish').click();
			})
			yield Zotero.Sync.Storage.Local.resolveConflicts(libraryID);
			yield promise;
			
			assert.equal(item1.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD);
			assert.equal(item1.attachmentSyncedModificationTime, json1.mtime);
			assert.equal(item1.attachmentSyncedHash, json1.md5);
			assert.equal(item3.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_DOWNLOAD);
			assert.isNull(item3.attachmentSyncedModificationTime);
			assert.isNull(item3.attachmentSyncedHash);
		});
		
		it("should handle attachment conflicts with no remote mtime/md5", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var item1 = yield importFileAttachment('test.png');
			item1.version = 10;
			yield item1.saveTx();
			
			var json1 = item1.toJSON();
			yield Zotero.Sync.Data.Local.saveCacheObjects('item', libraryID, [json1]);
			
			item1.attachmentSyncState = "in_conflict";
			yield item1.saveTx({ skipAll: true });
			
			var promise = waitForWindow('chrome://zotero/content/merge.xul', async function (dialog) {
				var doc = dialog.document;
				var wizard = doc.documentElement;
				var mergeGroup = wizard.getElementsByTagName('zoteromergegroup')[0];
				
				// 1 (remote)
				// Identical, so remote version should be selected
				assert.equal(mergeGroup.rightpane.getAttribute('selected'), 'true');
				
				// Select local object
				mergeGroup.leftpane.click();
				assert.equal(mergeGroup.leftpane.getAttribute('selected'), 'true');
				
				if (Zotero.isMac) {
					assert.isTrue(wizard.getButton('next').hidden);
					assert.isFalse(wizard.getButton('finish').hidden);
				}
				else {
					// TODO
				}
				wizard.getButton('finish').click();
			});
			yield Zotero.Sync.Storage.Local.resolveConflicts(libraryID);
			yield promise;
			
			assert.equal(item1.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD);
			assert.isNull(item1.attachmentSyncedModificationTime);
			assert.isNull(item1.attachmentSyncedHash);
		});
	})
})
