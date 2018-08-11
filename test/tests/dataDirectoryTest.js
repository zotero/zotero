"use strict";

describe("Zotero.DataDirectory", function () {
	var tmpDir, oldDir, newDir, dbFilename, oldDBFile, newDBFile, oldStorageDir, newStorageDir,
		oldTranslatorsDir, newTranslatorsDir, translatorName1, translatorName2,
		oldStorageDir1, newStorageDir1, storageFile1, oldStorageDir2, newStorageDir2, storageFile2,
		str1, str2, str3, str4, str5, str6,
		oldMigrationMarker, newMigrationMarker,
		stubs = {};
	
	before(function* () {
		tmpDir = yield getTempDirectory();
		oldDir = OS.Path.join(tmpDir, "old");
		newDir = OS.Path.join(tmpDir, "new");
		dbFilename = Zotero.DataDirectory.getDatabaseFilename();
		oldDBFile = OS.Path.join(oldDir, dbFilename);
		newDBFile = OS.Path.join(newDir, dbFilename);
		oldStorageDir = OS.Path.join(oldDir, "storage");
		newStorageDir = OS.Path.join(newDir, "storage");
		oldTranslatorsDir = OS.Path.join(oldDir, "translators");
		newTranslatorsDir = OS.Path.join(newDir, "translators");
		translatorName1 = 'a.js';
		translatorName2 = 'b.js';
		oldStorageDir1 = OS.Path.join(oldStorageDir, 'AAAAAAAA');
		newStorageDir1 = OS.Path.join(newStorageDir, 'AAAAAAAA');
		storageFile1 = 'test.pdf';
		oldStorageDir2 = OS.Path.join(oldStorageDir, 'BBBBBBBB');
		newStorageDir2 = OS.Path.join(newStorageDir, 'BBBBBBBB');
		storageFile2 = 'test.html';
		str1 = '1';
		str2 = '2';
		str3 = '3';
		str4 = '4';
		str5 = '5';
		str6 = '6';
		oldMigrationMarker = OS.Path.join(oldDir, Zotero.DataDirectory.MIGRATION_MARKER);
		newMigrationMarker = OS.Path.join(newDir, Zotero.DataDirectory.MIGRATION_MARKER);
		
		stubs.canMigrate = sinon.stub(Zotero.DataDirectory, "canMigrate").returns(true);
		// A pipe always exists during tests, since Zotero is running
		stubs.pipeExists = sinon.stub(Zotero.IPC, "pipeExists").returns(Zotero.Promise.resolve(false));
		stubs.setDataDir = sinon.stub(Zotero.DataDirectory, "set");
		stubs.isNewDirOnDifferentDrive = sinon.stub(Zotero.DataDirectory, 'isNewDirOnDifferentDrive').resolves(true);
	});
	
	beforeEach(function* () {
		stubs.setDataDir.reset();
	});
	
	afterEach(function* () {
		yield removeDir(oldDir);
		yield removeDir(newDir);
		Zotero.DataDirectory._cache(false);
		yield Zotero.DataDirectory.init();
	});
	
	after(function* () {
		for (let key in stubs) {
			try {
				stubs[key].restore();
			} catch(e) {}
		}
	});
	
	// Force non-mv mode
	var disableCommandMode = function () {
		if (!stubs.canMoveDirectoryWithCommand) {
			stubs.canMoveDirectoryWithCommand = sinon.stub(Zotero.File, "canMoveDirectoryWithCommand")
				.returns(false);
		}
	};
	
	// Force non-OS.File.move() mode
	var disableFunctionMode = function () {
		if (!stubs.canMoveDirectoryWithFunction) {
			stubs.canMoveDirectoryWithFunction = sinon.stub(Zotero.File, "canMoveDirectoryWithFunction")
				.returns(false);
		}
	};
	
	var resetCommandMode = function () {
		if (stubs.canMoveDirectoryWithCommand) {
			stubs.canMoveDirectoryWithCommand.restore();
			stubs.canMoveDirectoryWithCommand = undefined;
		}
	};
	
	var resetFunctionMode = function () {
		if (stubs.canMoveDirectoryWithFunction) {
			stubs.canMoveDirectoryWithFunction.restore();
			stubs.canMoveDirectoryWithFunction = undefined;
		}
	};
	
	var populateDataDirectory = Zotero.Promise.coroutine(function* (dir, srcDir, automatic = false) {
		yield OS.File.makeDir(dir, { unixMode: 0o755 });
		let storageDir = OS.Path.join(dir, 'storage');
		let storageDir1 = OS.Path.join(storageDir, 'AAAAAAAA');
		let storageDir2 = OS.Path.join(storageDir, 'BBBBBBBB');
		let translatorsDir = OS.Path.join(dir, 'translators');
		let migrationMarker = OS.Path.join(dir, Zotero.DataDirectory.MIGRATION_MARKER);
		
		// Database
		yield Zotero.File.putContentsAsync(OS.Path.join(dir, dbFilename), str1);
		// Database backup
		yield Zotero.File.putContentsAsync(OS.Path.join(dir, dbFilename + '.bak'), str2);
		// 'storage' directory
		yield OS.File.makeDir(storageDir, { unixMode: 0o755 });
		// 'storage' folders
		yield OS.File.makeDir(storageDir1, { unixMode: 0o755 });
		yield Zotero.File.putContentsAsync(OS.Path.join(storageDir1, storageFile1), str2);
		yield OS.File.makeDir(storageDir2, { unixMode: 0o755 });
		yield Zotero.File.putContentsAsync(OS.Path.join(storageDir2, storageFile2), str3);
		// 'translators' and some translators
		yield OS.File.makeDir(translatorsDir, { unixMode: 0o755 });
		yield Zotero.File.putContentsAsync(OS.Path.join(translatorsDir, translatorName1), str4);
		yield Zotero.File.putContentsAsync(OS.Path.join(translatorsDir, translatorName2), str5);
		// Migration marker
		yield Zotero.File.putContentsAsync(
			migrationMarker,
			JSON.stringify({
				sourceDir: srcDir || dir,
				automatic
			})
		);
	});
	
	var checkMigration = Zotero.Promise.coroutine(function* (options = {}) {
		if (!options.skipOldDir) {
			assert.isFalse(yield OS.File.exists(oldDir));
		}
		yield assert.eventually.equal(Zotero.File.getContentsAsync(newDBFile), str1);
		yield assert.eventually.equal(Zotero.File.getContentsAsync(newDBFile + '.bak'), str2);
		if (!options.skipStorageFile1) {
			yield assert.eventually.equal(
				Zotero.File.getContentsAsync(OS.Path.join(newStorageDir1, storageFile1)), str2
			);
		}
		yield assert.eventually.equal(
			Zotero.File.getContentsAsync(OS.Path.join(newStorageDir2, storageFile2)), str3
		);
		yield assert.eventually.equal(
			Zotero.File.getContentsAsync(OS.Path.join(newTranslatorsDir, translatorName1)), str4
		);
		yield assert.eventually.equal(
			Zotero.File.getContentsAsync(OS.Path.join(newTranslatorsDir, translatorName2)), str5
		);
		if (!options.skipNewMarker) {
			assert.isFalse(yield OS.File.exists(newMigrationMarker));
		}
		
		if (!options.skipSetDataDirectory) {
			assert.ok(stubs.setDataDir.calledOnce);
			assert.ok(stubs.setDataDir.calledWith(newDir));
		}
	});
	
	
	describe("#checkForMigration()", function () {
		let fileMoveStub;
		
		beforeEach(function () {
			disableCommandMode();
			disableFunctionMode();
		});
		
		after(function () {
			resetCommandMode();
			resetFunctionMode();
		});
		
		var tests = [];
		function add(desc, fn) {
			tests.push([desc, fn]);
		}
		
		it("should skip automatic migration if target directory exists and is non-empty", function* () {
			resetCommandMode();
			resetFunctionMode();
			
			yield populateDataDirectory(oldDir);
			yield OS.File.remove(oldMigrationMarker);
			yield OS.File.makeDir(newDir, { unixMode: 0o755 });
			yield Zotero.File.putContentsAsync(OS.Path.join(newDir, 'a'), '');
			
			yield assert.eventually.isFalse(Zotero.DataDirectory.checkForMigration(oldDir, newDir));
		});
		
		it("should skip automatic migration and show prompt if target directory is on a different drive", function* () {
			resetCommandMode();
			resetFunctionMode();
			
			yield populateDataDirectory(oldDir);
			yield OS.File.remove(oldMigrationMarker);
			
			stubs.isNewDirOnDifferentDrive.resolves(true);
			
			var promise = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString(`dataDir.migration.failure.full.automatic.newDirOnDifferentDrive`, Zotero.clientName)
				);
			}, 'cancel');
			
			yield assert.eventually.isNotOk(Zotero.DataDirectory.checkForMigration(oldDir, newDir));
			yield promise;

			stubs.isNewDirOnDifferentDrive.resolves(false);
		});
		
		add("should show error on partial failure", function (automatic) {
			return function* () {
				yield populateDataDirectory(oldDir, null, automatic);
				
				let origFunc = OS.File.move;
				let fileMoveStub = sinon.stub(OS.File, "move").callsFake(function () {
					if (OS.Path.basename(arguments[0]) == storageFile1) {
						return Zotero.Promise.reject(new Error("Error"));
					}
					else {
						return origFunc(...arguments);
					}
				});
				let stub1 = sinon.stub(Zotero.File, "reveal").returns(Zotero.Promise.resolve());
				let stub2 = sinon.stub(Zotero.Utilities.Internal, "quitZotero");
				
				var promise2;
				// Click "Try Again" the first time, and then "Show Directories and Quit Zotero"
				var promise = waitForDialog(function (dialog) {
					promise2 = waitForDialog(null, 'extra1');
					
					// Make sure we're displaying the right message for this mode (automatic or manual)
					Components.utils.import("resource://zotero/config.js");
					assert.include(
						dialog.document.documentElement.textContent,
						Zotero.getString(
							`dataDir.migration.failure.partial.${automatic ? 'automatic' : 'manual'}.text`,
							[ZOTERO_CONFIG.CLIENT_NAME, Zotero.appName]
						)
					);
				});
				yield Zotero.DataDirectory.checkForMigration(oldDir, newDir);
				yield promise;
				yield promise2;
				
				assert.isTrue(stub1.calledTwice);
				assert.isTrue(stub1.getCall(0).calledWith(oldStorageDir));
				assert.isTrue(stub1.getCall(1).calledWith(newDBFile));
				assert.isTrue(stub2.called);
				
				fileMoveStub.restore();
				stub1.restore();
				stub2.restore();
			};
		});
		
		add("should show error on full failure", function (automatic) {
			return function* () {
				yield populateDataDirectory(oldDir, null, automatic);
				
				let origFunc = OS.File.move;
				let stub1 = sinon.stub(OS.File, "move").callsFake(function () {
					if (OS.Path.basename(arguments[0]) == dbFilename) {
						return Zotero.Promise.reject(new Error("Error"));
					}
					else {
						return origFunc(...arguments);
					}
				});
				let stub2 = sinon.stub(Zotero.File, "reveal").returns(Zotero.Promise.resolve());
				let stub3 = sinon.stub(Zotero.Utilities.Internal, "quitZotero");
				
				var promise = waitForDialog(function (dialog) {
					// Make sure we're displaying the right message for this mode (automatic or manual)
					Components.utils.import("resource://zotero/config.js");
					assert.include(
						dialog.document.documentElement.textContent,
						Zotero.getString(
							`dataDir.migration.failure.full.${automatic ? 'automatic' : 'manual'}.text1`,
							ZOTERO_CONFIG.CLIENT_NAME
						)
					);
				});
				yield Zotero.DataDirectory.checkForMigration(oldDir, newDir);
				yield promise;
				
				assert.isTrue(stub2.calledOnce);
				assert.isTrue(stub2.calledWith(oldDir));
				assert.isTrue(stub3.called);
				
				stub1.restore();
				stub2.restore();
				stub3.restore();
			};
		});
		
		describe("automatic mode", function () {
			tests.forEach(arr => {
				it(arr[0], arr[1](true));
			});
		});
		
		describe("manual mode", function () {
			tests.forEach(arr => {
				it(arr[0], arr[1](false));
			});
		});
		
		it("should remove marker if old directory doesn't exist", function* () {
			yield populateDataDirectory(newDir, oldDir);
			yield Zotero.DataDirectory.checkForMigration(newDir, newDir);
			yield checkMigration({
				skipSetDataDirectory: true
			});
		});
	});
	
	
	describe("#migrate()", function () {
		// Define tests and store for running in non-mv mode
		var tests = [];
		function add(desc, fn) {
			it(desc, fn);
			tests.push([desc, fn]);
		}
		
		add("should move all files and folders", function* () {
			yield populateDataDirectory(oldDir);
			yield Zotero.DataDirectory.migrate(oldDir, newDir);
			yield checkMigration();
		});
		
		add("should resume partial migration with just marker copied", function* () {
			yield populateDataDirectory(oldDir);
			yield OS.File.makeDir(newDir, { unixMode: 0o755 });
			
			yield OS.File.copy(oldMigrationMarker, newMigrationMarker);
			
			yield Zotero.DataDirectory.migrate(oldDir, newDir, true);
			yield checkMigration();
		});
		
		add("should resume partial migration with database moved", function* () {
			yield populateDataDirectory(oldDir);
			yield OS.File.makeDir(newDir, { unixMode: 0o755 });
			
			yield OS.File.copy(oldMigrationMarker, newMigrationMarker);
			yield OS.File.move(OS.Path.join(oldDir, dbFilename), OS.Path.join(newDir, dbFilename));
			
			yield Zotero.DataDirectory.migrate(oldDir, newDir, true);
			yield checkMigration();
		});
		
		add("should resume partial migration with some storage directories moved", function* () {
			yield populateDataDirectory(oldDir);
			yield populateDataDirectory(newDir, oldDir);
			
			// Moved: DB, DB backup, one storage dir
			// Not moved: one storage dir, translators dir
			yield OS.File.remove(oldDBFile);
			yield OS.File.remove(oldDBFile + '.bak');
			yield removeDir(oldStorageDir1);
			yield removeDir(newTranslatorsDir);
			yield removeDir(newStorageDir2);
			
			yield Zotero.DataDirectory.migrate(oldDir, newDir, true);
			yield checkMigration();
		});
		
		// Run all tests again without using mv
		//
		// On Windows these will just be duplicates of the above tests.
		describe("non-mv mode", function () {
			tests.forEach(arr => {
				it(arr[0] + " [non-mv]", arr[1]);
			});
			
			before(function () {
				disableCommandMode();
				disableFunctionMode();
			});
			
			after(function () {
				resetCommandMode();
				resetFunctionMode();
			});
			
			it("should handle partial failure", function* () {
				yield populateDataDirectory(oldDir);
				
				let origFunc = OS.File.move;
				let stub1 = sinon.stub(OS.File, "move").callsFake(function () {
					if (OS.Path.basename(arguments[0]) == storageFile1) {
						return Zotero.Promise.reject(new Error("Error"));
					}
					else {
						return origFunc(...arguments);
					}
				});
				
				yield Zotero.DataDirectory.migrate(oldDir, newDir);
				
				stub1.restore();
				
				yield checkMigration({
					skipOldDir: true,
					skipStorageFile1: true,
					skipNewMarker: true
				});
				
				assert.isTrue(yield OS.File.exists(OS.Path.join(oldStorageDir1, storageFile1)));
				assert.isFalse(yield OS.File.exists(OS.Path.join(oldStorageDir2, storageFile2)));
				assert.isFalse(yield OS.File.exists(oldTranslatorsDir));
				assert.isTrue(yield OS.File.exists(newMigrationMarker));
			});
		});
	});
});
