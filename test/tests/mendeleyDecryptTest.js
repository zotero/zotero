describe('Mendeley Decrypt', function () {
	var {
		decryptDatabase,
		getProfileUUID,
		isDatabaseInUse,
		isEncryptedDatabase
	} = ChromeUtils.importESModule("chrome://zotero/content/import/mendeley/mendeleyDecrypt.mjs");

	const PROFILE_UUID = '57173eea-07fc-3382-a3f7-548dff05def8';
	const ENCRYPTED_DB = `${PROFILE_UUID}@www.mendeley.com.sqlite`;

	var encryptedPath, tmpDirectory;

	before(function () {
		encryptedPath = OS.Path.join(getTestDataDirectory().path, ENCRYPTED_DB);
	});

	beforeEach(async function () {
		tmpDirectory = OS.Path.join(Zotero.getTempDirectory().path, Zotero.Utilities.randomString());
		await Zotero.File.createDirectoryIfMissingAsync(tmpDirectory);
	});

	afterEach(async function () {
		await IOUtils.remove(tmpDirectory, { recursive: true, ignoreAbsent: true });
	});

	describe('#getProfileUUID()', function () {
		it('should return the UUID from a Mendeley database filename', function () {
			assert.equal(getProfileUUID(encryptedPath), PROFILE_UUID);
		});

		it("should return null if the filename doesn't contain a UUID", function () {
			assert.isNull(getProfileUUID('/tmp/1@www.mendeley.com.sqlite'));
			assert.isNull(getProfileUUID('/tmp/online.sqlite'));
		});
	});

	describe('#isEncryptedDatabase()', function () {
		it('should detect an encrypted Mendeley database', async function () {
			assert.isTrue(await isEncryptedDatabase(encryptedPath));
		});

		it('should not detect an unencrypted SQLite database', async function () {
			assert.isFalse(
				await isEncryptedDatabase(OS.Path.join(getTestDataDirectory().path, 'test.sqlite'))
			);
		});

		it('should not detect a missing file', async function () {
			assert.isFalse(await isEncryptedDatabase(OS.Path.join(tmpDirectory, 'nonexistent.sqlite')));
		});
	});

	describe('#isDatabaseInUse()', function () {
		var dbPath;

		beforeEach(async function () {
			dbPath = OS.Path.join(tmpDirectory, ENCRYPTED_DB);
			await IOUtils.copy(encryptedPath, dbPath);
		});

		it('should return false without a write-ahead log', async function () {
			assert.isFalse(await isDatabaseInUse(dbPath));
		});

		it('should return true with a non-empty write-ahead log', async function () {
			await IOUtils.write(dbPath + '-wal', new Uint8Array(32));
			assert.isTrue(await isDatabaseInUse(dbPath));
		});

		it('should return false with an empty write-ahead log', async function () {
			await IOUtils.write(dbPath + '-wal', new Uint8Array());
			assert.isFalse(await isDatabaseInUse(dbPath));
		});

		it('should return true with a shared-memory file', async function () {
			await IOUtils.write(dbPath + '-shm', new Uint8Array(32));
			assert.isTrue(await isDatabaseInUse(dbPath));
		});
	});

	describe('#decryptDatabase()', function () {
		it('should decrypt a database into one Zotero can read', async function () {
			var decryptedPath = OS.Path.join(tmpDirectory, ENCRYPTED_DB);
			await decryptDatabase(encryptedPath, decryptedPath);

			var db = new Zotero.DBConnection(decryptedPath);
			try {
				assert.equal(await db.valueQueryAsync("PRAGMA integrity_check"), 'ok');
				assert.isTrue(await db.tableExists('Documents'));
				assert.equal(
					await db.valueQueryAsync("SELECT COUNT(*) FROM Documents"), 3
				);
				assert.equal(
					await db.valueQueryAsync("SELECT uuid FROM Profiles"), PROFILE_UUID
				);
			}
			finally {
				await db.closeDatabase();
			}
		});

		it('should leave the encrypted database untouched', async function () {
			var before = await IOUtils.read(encryptedPath);
			await decryptDatabase(encryptedPath, OS.Path.join(tmpDirectory, ENCRYPTED_DB));
			assert.deepEqual(Array.from(await IOUtils.read(encryptedPath)), Array.from(before));
		});

		it('should reject a database whose key cannot be derived', async function () {
			// The key is folded with the profile UUID, so a renamed database can't
			// be decrypted
			var renamedPath = OS.Path.join(tmpDirectory, '1@www.mendeley.com.sqlite');
			await IOUtils.copy(encryptedPath, renamedPath);
			var error = await getPromiseError(
				decryptDatabase(renamedPath, OS.Path.join(tmpDirectory, 'out.sqlite'))
			);
			assert.equal(error.message, 'Cannot derive Mendeley database key');
		});

		it('should reject a file that is not an encrypted database', async function () {
			var notADatabasePath = OS.Path.join(tmpDirectory, 'x@www.mendeley.com.sqlite');
			await Zotero.File.putContentsAsync(notADatabasePath, 'not a database');
			var error = await getPromiseError(
				decryptDatabase(notADatabasePath, OS.Path.join(tmpDirectory, 'out.sqlite'))
			);
			assert.equal(error.message, 'Unsupported Mendeley database encryption');
		});
	});

	describe('Importing an encrypted database', function () {
		const BITCOIN_TITLE = 'Bitcoin: A Peer-to-Peer Electronic Cash System';
		const BITCOIN_PDF = 'Nakamoto - Unknown - Bitcoin A Peer-to-Peer Electronic Cash System.pdf';

		var win;

		const getDecryptedCopies = async function () {
			let dirs = [];
			for (let entry of await IOUtils.getChildren(Zotero.getTempDirectory().path)) {
				if (PathUtils.filename(entry).startsWith('mendeley-')) {
					dirs.push(entry);
				}
			}
			return dirs;
		};

		before(async function () {
			win = await loadZoteroPane();
		});

		after(function () {
			win.close();
		});

		it('should import items and remove the decrypted copy', async function () {
			this.timeout(60000);
			assert.lengthOf(await getDecryptedCopies(), 0);

			await win.Zotero_File_Interface.importFile({
				file: Zotero.File.pathToFile(encryptedPath),
				createNewCollection: true
			});

			let collections = Zotero.Collections
				.getByLibrary(Zotero.Libraries.userLibraryID)
				.filter(c => c.name.startsWith('Mendeley Import'));
			assert.lengthOf(collections, 1);
			let titles = collections[0].getChildItems().map(item => item.getField('title'));
			assert.include(titles, BITCOIN_TITLE);

			assert.lengthOf(await getDecryptedCopies(), 0);
		});

		it('should look for attachments beside the encrypted database', async function () {
			this.timeout(60000);
			// A backup from another machine, whose absolute Downloaded paths don't exist here
			let backupPath = OS.Path.join(tmpDirectory, ENCRYPTED_DB);
			await IOUtils.copy(encryptedPath, backupPath);
			let downloadedDirectory = OS.Path.join(tmpDirectory, 'Downloaded');
			await Zotero.File.createDirectoryIfMissingAsync(downloadedDirectory);
			await IOUtils.copy(
				OS.Path.join(getTestDataDirectory().path, 'test.pdf'),
				OS.Path.join(downloadedDirectory, BITCOIN_PDF)
			);

			var translation;
			await win.Zotero_File_Interface.importFile({
				file: Zotero.File.pathToFile(backupPath),
				createNewCollection: false,
				onBeforeImport: (t) => {
					translation = t;
				}
			});

			let item = translation.newItems.find(i => i.getField('title') == BITCOIN_TITLE);
			let attachments = Zotero.Items.get(item.getAttachments());
			assert.lengthOf(attachments, 1);
			assert.isTrue(await OS.File.exists(await attachments[0].getFilePathAsync()));
		});

		it('should remove the decrypted copy if the import fails', async function () {
			this.timeout(60000);
			// Fails after the database has been decrypted but before it's read
			var error = await getPromiseError(
				win.Zotero_File_Interface.importFile({
					file: Zotero.File.pathToFile(encryptedPath),
					createNewCollection: false,
					onBeforeImport: () => {
						throw new Error('Import failed');
					}
				})
			);
			assert.equal(error.message, 'Import failed');
			assert.lengthOf(await getDecryptedCopies(), 0);
		});

		it('should not import if cancelled while decrypting', async function () {
			this.timeout(60000);
			var numCollections = Zotero.Collections
				.getByLibrary(Zotero.Libraries.userLibraryID).length;
			var controller = new AbortController();
			var onBeforeImport = sinon.stub();
			// Cancelled once the decrypted database is being written out
			var createDirectory = Zotero.File.createDirectoryIfMissingAsync;
			Zotero.File.createDirectoryIfMissingAsync = async function (path, options) {
				await createDirectory.call(Zotero.File, path, options);
				if (PathUtils.filename(path).startsWith('mendeley-')) {
					controller.abort();
				}
			};
			var result;
			try {
				result = await win.Zotero_File_Interface.importFile({
					file: Zotero.File.pathToFile(encryptedPath),
					createNewCollection: true,
					onBeforeImport,
					signal: controller.signal
				});
			}
			finally {
				Zotero.File.createDirectoryIfMissingAsync = createDirectory;
			}

			assert.isFalse(result);
			assert.isFalse(onBeforeImport.called);
			assert.lengthOf(
				Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID), numCollections
			);
			assert.lengthOf(await getDecryptedCopies(), 0);
		});

		it('should keep the decrypted copy unreadable by other users', async function () {
			if (Zotero.isWin) {
				this.skip();
			}
			this.timeout(60000);
			// The directory is removed once the import finishes, so check its
			// permissions as it's created
			var permissions;
			var createDirectory = Zotero.File.createDirectoryIfMissingAsync;
			Zotero.File.createDirectoryIfMissingAsync = async function (path, options) {
				await createDirectory.call(Zotero.File, path, options);
				if (PathUtils.filename(path).startsWith('mendeley-')) {
					({ permissions } = await IOUtils.stat(path));
				}
			};
			try {
				await win.Zotero_File_Interface.importFile({
					file: Zotero.File.pathToFile(encryptedPath),
					createNewCollection: false
				});
			}
			finally {
				Zotero.File.createDirectoryIfMissingAsync = createDirectory;
			}
			assert.equal(permissions, 0o700);
		});

		it('should refuse to import while Mendeley has the database open', async function () {
			let inUsePath = OS.Path.join(tmpDirectory, ENCRYPTED_DB);
			await IOUtils.copy(encryptedPath, inUsePath);
			await IOUtils.write(inUsePath + '-wal', new Uint8Array(32));

			let error = await getPromiseError(
				win.Zotero_File_Interface.importFile({
					file: Zotero.File.pathToFile(inUsePath),
					createNewCollection: true
				})
			);
			assert.equal(error.message, 'Mendeley database in use');
			assert.lengthOf(await getDecryptedCopies(), 0);
		});
	});
});
