describe("Zotero.DB", function () {
	var tmpTable = "tmpDBTest";
	
	before(function* () {
		this.timeout(5000);
		Zotero.debug("Waiting for DB activity to settle");
		yield Zotero.DB.waitForTransaction();
		yield Zotero.Promise.delay(1000);
	});
	beforeEach(function* () {
		yield Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable);
		yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
	});
	after(function* () {
		yield Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable);
	});
	
	
	describe("#queryAsync()", function () {
		var tmpTable;
		
		before(function* () {
			tmpTable = "tmp_queryAsync";
			yield Zotero.DB.queryAsync("CREATE TEMPORARY TABLE " + tmpTable + " (a, b)");
			yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1, 2)");
			yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (3, 4)");
			yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (5, NULL)");
		})
		after(function* () {
			if (tmpTable) {
				yield Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable);
			}
		})
		
		it("should throw an error if no parameters are passed for a query with placeholders", async function () {
			var e = await getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?"));
			assert.ok(e);
			assert.include(e.message, "for query containing placeholders");
		})
		
		it("should throw an error if too few parameters are passed", async function () {
			var e = await getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=? OR itemID=?", [1]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should throw an error if too many parameters are passed", async function () {
			var e = await getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?", [1, 2]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should throw an error if too many parameters are passed for numbered placeholders", async function () {
			var e = await getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?1 OR itemID=?1", [1, 2]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should accept a single placeholder given as a value", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", 2);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept a single placeholder given as an array", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", [2]);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept multiple placeholders", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=? OR b=?", [2, 4]);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 3);
		});
		
		it("should accept combination of numbered and unnumbered placeholders", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE (a=?1 OR b=?1) OR b=?", [2, 4]);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 3);
		});
		
		it("should accept a single placeholder within parentheses", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?)", 2);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept multiple placeholders within parentheses", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?, ?)", [2, 4]);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 3);
		})
		
		it("should replace =? with IS NULL if NULL is passed as a value", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", null);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 5);
		})
		
		it("should replace =? with IS NULL if NULL is passed in an array", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", [null]);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 5);
		})
		
		it("should replace ? with NULL for placeholders within parentheses in INSERT statements", async function () {
			await Zotero.DB.queryAsync("CREATE TEMPORARY TABLE tmp_srqwnfpwpinss (a, b)");
			// Replace ", ?"
			await Zotero.DB.queryAsync("INSERT INTO tmp_srqwnfpwpinss (a, b) VALUES (?, ?)", [1, null]);
			assert.equal(
				((await Zotero.DB.valueQueryAsync("SELECT a FROM tmp_srqwnfpwpinss WHERE b IS NULL"))),
				1
			);
			// Replace "(?"
			await Zotero.DB.queryAsync("DELETE FROM tmp_srqwnfpwpinss");
			await Zotero.DB.queryAsync("INSERT INTO tmp_srqwnfpwpinss (a, b) VALUES (?, ?)", [null, 2]);
			assert.equal(
				((await Zotero.DB.valueQueryAsync("SELECT b FROM tmp_srqwnfpwpinss WHERE a IS NULL"))),
				2
			);
			await Zotero.DB.queryAsync("DROP TABLE tmp_srqwnfpwpinss");
		})
		
		it("should throw an error if NULL is passed for placeholder within parentheses in a SELECT statement", async function () {
			var e = await getPromiseError(Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?)", null));
			assert.ok(e);
			assert.include(e.message, "NULL cannot be used for parenthesized placeholders in SELECT queries");
		})
		
		it("should handle numbered parameters", async function () {
			var rows = await Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?1 "
				+ "UNION SELECT b FROM " + tmpTable + " WHERE b=?1", 2);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 2);
		})
		
		it("should throw an error if onRow throws an error", async function () {
			var i = 0;
			var e = Zotero.DB.queryAsync(
				"SELECT * FROM " + tmpTable,
				false,
				{
					onRow: function (row) {
						if (i > 0) {
							throw new Error("Failed");
						}
						i++;
					}
				}
			);
			e = await getPromiseError(e)
			assert.ok(e);
			assert.equal(e.message, "Failed");
		});
		
		it("should stop gracefully if onRow calls cancel()", async function () {
			var i = 0;
			var rows = [];
			await Zotero.DB.queryAsync(
				"SELECT * FROM " + tmpTable,
				false,
				{
					onRow: function (row, cancel) {
						if (i > 0) {
							cancel();
							return;
						}
						rows.push(row.getResultByIndex(0));
						i++;
					}
				}
			);
			assert.lengthOf(rows, 1);
		});
	})
	
	
	describe("#executeTransaction()", function () {
		it("should serialize concurrent transactions", async function () {
			var resolve1, resolve2, reject1, reject2;
			var promise1 = new Promise(function (resolve, reject) {
				resolve1 = resolve;
				reject1 = reject;
			});
			var promise2 = new Promise(function (resolve, reject) {
				resolve2 = resolve;
				reject2 = reject;
			});
			
			Zotero.DB.executeTransaction(async function () {
				await Zotero.Promise.delay(250);
				var num = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 0);
				await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve1)
			.catch(reject1);
			
			Zotero.DB.executeTransaction(async function () {
				var num = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 1);
				await Zotero.Promise.delay(500);
				await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve2)
			.catch(reject2);
			
			await Promise.all([promise1, promise2]);
		});
		
		it("should serialize queued transactions", async function () {
			var resolve1, resolve2, reject1, reject2, resolve3, reject3;
			var promise1 = new Promise(function (resolve, reject) {
				resolve1 = resolve;
				reject1 = reject;
			});
			var promise2 = new Promise(function (resolve, reject) {
				resolve2 = resolve;
				reject2 = reject;
			});
			var promise3 = new Promise(function (resolve, reject) {
				resolve3 = resolve;
				reject3 = reject;
			});
			
			// Start a transaction and have it delay
			Zotero.DB.executeTransaction(async function () {
				await Zotero.Promise.delay(100);
				var num = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 0);
				await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve1)
			.catch(reject1);
			
			// Start two more transactions, which should wait on the first
			Zotero.DB.executeTransaction(async function () {
				var num = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 1);
				await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve2)
			.catch(reject2);
			
			Zotero.DB.executeTransaction(async function () {
				var num = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 2);
				await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (3)");
				// But make sure the second queued transaction doesn't start at the same time,
				// such that the first queued transaction gets closed while the second is still
				// running
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve3)
			.catch(reject3);
			
			await Promise.all([promise1, promise2, promise3]);
		})
		
		it("should roll back on error", async function () {
			await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
			try {
				await Zotero.DB.executeTransaction(async function () {
					await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
					throw 'Aborting transaction -- ignore';
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			var count = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable + "");
			assert.equal(count, 1);
			
			var conn = await Zotero.DB._getConnectionAsync();
			assert.isFalse(conn.transactionInProgress);
			
			await Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
		
		it("should run onRollback callbacks", async function () {
			var callbackRan = false;
			try {
				await Zotero.DB.executeTransaction(
					async function () {
						await Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
						throw 'Aborting transaction -- ignore';
					},
					{
						onRollback: function () {
							callbackRan = true;
						}
					}
				);
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			assert.ok(callbackRan);
			
			await Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
		
		it("should time out on nested transactions", async function () {
			var e;
			await Zotero.DB.executeTransaction(async function () {
				e = await getPromiseError(
					Promise.race([
						Zotero.Promise.delay(250).then(() => {
							var e = new Error;
							e.name = "TimeoutError";
							throw e;
						}),
						Zotero.DB.executeTransaction(async function () {})
					])
				);
			});
			assert.ok(e);
			assert.equal(e.name, "TimeoutError");
		});
		
		it("should run onRollback callbacks for timed-out nested transactions", async function () {
			var callback1Ran = false;
			var callback2Ran = false;
			try {
				await Zotero.DB.executeTransaction(async function () {
					await Zotero.DB.executeTransaction(
						async function () {},
						{
							waitTimeout: 100,
							onRollback: function () {
								callback1Ran = true;
							}
						}
					)
				},
				{
					onRollback: function () {
						callback2Ran = true;
					}
				});
			}
			catch (e) {
				if (e.name != "TimeoutError") throw e;
			}
			assert.ok(callback1Ran);
			assert.ok(callback2Ran);
		});
	})
	
	
	describe("#columnExists()", function () {
		it("should return true if a column exists", async function () {
			assert.isTrue(await Zotero.DB.columnExists('items', 'itemID'));
		});
		
		it("should return false if a column doesn't exists", async function () {
			assert.isFalse(await Zotero.DB.columnExists('items', 'foo'));
		});
		
		it("should return false if a table doesn't exists", async function () {
			assert.isFalse(await Zotero.DB.columnExists('foo', 'itemID'));
		});
	});
	
	
	describe("#indexExists()", function () {
		it("should return true if an index exists", async function () {
			assert.isTrue(await Zotero.DB.indexExists('items_synced'));
		});
		
		it("should return false if an index doesn't exists", async function () {
			assert.isFalse(await Zotero.DB.indexExists('foo'));
		});
	});
	
	
	describe("#parseSQLFile", function () {
		it("should extract tables and indexes from userdata SQL file", async function () {
			var sql = Zotero.File.getResource(`resource://zotero/schema/userdata.sql`);
			var statements = await Zotero.DB.parseSQLFile(sql);
			assert.isTrue(statements.some(x => x.startsWith('CREATE TABLE items')));
		});
	});
	
	describe("#backUpDatabase()", function () {
		var bakFile;
		var bakFile2;
		
		beforeEach(async function () {
			bakFile = Zotero.DB.path + '.test.bak';
			bakFile2 = Zotero.DB.path + '.test2.bak';
			await IOUtils.remove(bakFile);
			await IOUtils.remove(bakFile2);
		});
		
		afterEach(async function () {
			await IOUtils.remove(bakFile);
			await IOUtils.remove(bakFile2);
		});
		
		it("should perform an offline backup", async function () {
			await Zotero.DB.backUpDatabase({ suffix: 'test' });
			assert.isTrue(await IOUtils.exists(bakFile));
			assert.equal(await Zotero.DB.valueQueryAsync("PRAGMA main.locking_mode"), "exclusive");
		});
		
		it("should perform an online backup", async function () {
			await Zotero.DB.backUpDatabase({ suffix: 'test', online: true });
			assert.isTrue(await IOUtils.exists(bakFile));
			assert.equal(await Zotero.DB.valueQueryAsync("PRAGMA main.locking_mode"), "exclusive");
		});
		
		it("shouldn't perform an offline backup if one is already in progress", async function () {
			var promise = Zotero.DB.backUpDatabase({ suffix: 'test' });
			var result2 = await Zotero.DB.backUpDatabase({ suffix: 'test2' });
			var result1 = await promise;
			assert.isTrue(result1);
			assert.isTrue(await IOUtils.exists(bakFile));
			// Return value is true, but file won't exist
			assert.isTrue(result2);
			assert.isFalse(await IOUtils.exists(bakFile2));
		});
		
	});
	

	describe("#_checkException()", function () {
		afterEach(function () {
			// Unlock the pane locked by recovery progress messages
			Zotero.hideZoteroPaneOverlays();
		});
		
		it("should save a verified copy and restart on a corruption error with stale journal files", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			// Corruption handling is skipped for external databases. Set after the database
			// is created and closed so that opening it doesn't register the idle observer.
			db._externalDB = false;
			
			let quitStub = sinon.stub(Zotero.Utilities.Internal, 'quit');
			let promptService = Services.prompt;
			let promptStub = sinon.stub().throws(new Error("Prompt shouldn't be shown"));
			Services.prompt = { confirmEx: promptStub };
			// Simulate the live database failing the quick check, as with a genuinely
			// mismatched WAL -- SQLite ignores the fake WAL file, which has invalid magic
			let quickCheckStub = sinon.stub(db, 'valueQueryAsync').resolves('row 1 missing');
			try {
				await db._checkException(new Error("database disk image is malformed"));
				// Further corruption errors while the restart is pending should be ignored
				await db._checkException(new Error("database disk image is malformed"));
			}
			finally {
				quitStub.restore();
				Services.prompt = promptService;
				quickCheckStub.restore();
				Zotero.skipLoading = false;
				await db.closeDatabase();
			}
			
			assert.isTrue(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isTrue(await IOUtils.exists(dbPath + '.repair.tmp.verified'));
			assert.isTrue(quickCheckStub.calledOnceWithExactly("PRAGMA main.quick_check(1)"));
			assert.isTrue(quitStub.calledOnce);
			assert.isTrue(promptStub.notCalled);
		});
		
		it("shouldn't start recovery if the main database passes a quick check", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			// Flip with the connection open so that the real quick check below doesn't reopen
			// the database via internal initialization, which registers the idle observer
			db._externalDB = false;
			
			let quitStub = sinon.stub(Zotero.Utilities.Internal, 'quit');
			let promptService = Services.prompt;
			let promptStub = sinon.stub().throws(new Error("Prompt shouldn't be shown"));
			Services.prompt = { confirmEx: promptStub };
			let progressSpy = sinon.spy(Zotero, 'showZoteroPaneProgressMeter');
			try {
				// SQLite ignores the fake WAL file, which has invalid magic, so the real
				// quick check passes and the error is treated as attached-database corruption
				assert.isTrue(
					await db._checkException(new Error("database disk image is malformed"))
				);
				assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
				assert.isTrue(await IOUtils.exists(dbPath + '-wal'));
			}
			finally {
				quitStub.restore();
				Services.prompt = promptService;
				progressSpy.restore();
				await db.closeDatabase();
			}
			assert.isTrue(quitStub.notCalled);
			assert.isTrue(promptStub.notCalled);
			// Progress text should have been shown during the check and the pane unlocked
			// after the early return
			assert.isTrue(progressSpy.called);
			assert.isFalse(Zotero.locked);
		});
		
		it("should restore another operation's progress display after an attached-database error", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			// Flip with the connection open so that the real quick check below doesn't reopen
			// the database via internal initialization
			db._externalDB = false;
			
			// Simulate another operation's determinate progress display, advanced partway
			let outerToken = Zotero.showZoteroPaneProgressMeter("Other operation", true);
			Zotero.updateZoteroPaneProgressMeter(30);
			let progressSpy = sinon.spy(Zotero, 'showZoteroPaneProgressMeter');
			try {
				// The real quick check passes, so the error is treated as attached-database
				// corruption, and the other operation's display should be restored
				assert.isTrue(
					await db._checkException(new Error("database disk image is malformed"))
				);
				assert.isTrue(progressSpy.calledWith("Other operation", true));
				assert.isTrue(Zotero.locked);
			}
			finally {
				progressSpy.restore();
				await db.closeDatabase();
			}
			// Ownership should have been returned to the other operation, so its own token
			// can still restore
			Zotero.restoreZoteroPaneProgressMeter(outerToken);
			assert.isFalse(Zotero.locked);
		});
		
		it("should unlock the pane if recovery is declined", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			db._externalDB = false;
			
			let quitStub = sinon.stub(Zotero.Utilities.Internal, 'quit');
			let promptService = Services.prompt;
			// Cancel the corruption dialog
			let promptStub = sinon.stub().returns(1);
			Services.prompt = { confirmEx: promptStub };
			let quickCheckStub = sinon.stub(db, 'valueQueryAsync').resolves('row 1 missing');
			try {
				assert.isFalse(
					await db._checkException(new Error("database disk image is malformed"))
				);
			}
			finally {
				quitStub.restore();
				Services.prompt = promptService;
				quickCheckStub.restore();
				await db.closeDatabase();
			}
			assert.isTrue(promptStub.called);
			assert.isTrue(quitStub.notCalled);
			assert.isFalse(Zotero.locked);
			assert.isFalse(await IOUtils.exists(dbPath + '.is.corrupt'));
			// Later corruption errors can re-trigger handling
			assert.isFalse(db._handlingCorruption);
		});
		
		it("shouldn't start recovery if the quick check fails for a non-corruption reason", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			db._externalDB = false;
			
			let quitStub = sinon.stub(Zotero.Utilities.Internal, 'quit');
			let promptService = Services.prompt;
			let promptStub = sinon.stub().throws(new Error("Prompt shouldn't be shown"));
			Services.prompt = { confirmEx: promptStub };
			let quickCheckStub = sinon.stub(db, 'valueQueryAsync')
				.rejects(new Error("disk I/O error"));
			try {
				assert.isTrue(
					await db._checkException(new Error("database disk image is malformed"))
				);
			}
			finally {
				quitStub.restore();
				Services.prompt = promptService;
				quickCheckStub.restore();
				await db.closeDatabase();
			}
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isTrue(quitStub.notCalled);
			assert.isTrue(promptStub.notCalled);
			assert.isFalse(Zotero.locked);
		});
		
		it("should skip the quick check if main-database corruption is already confirmed", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			db._externalDB = false;
			
			let quitStub = sinon.stub(Zotero.Utilities.Internal, 'quit');
			let promptService = Services.prompt;
			let promptStub = sinon.stub().throws(new Error("Prompt shouldn't be shown"));
			Services.prompt = { confirmEx: promptStub };
			try {
				// The quick check would pass here, but a caller that has already confirmed
				// corruption with a full integrity check overrides it
				await db._checkException(
					new Error("database disk image is malformed"),
					{ mainConfirmedCorrupt: true }
				);
			}
			finally {
				quitStub.restore();
				Services.prompt = promptService;
				Zotero.skipLoading = false;
				await db.closeDatabase();
			}
			assert.isTrue(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isTrue(quitStub.calledOnce);
			assert.isTrue(promptStub.notCalled);
		});
	});
	

	describe("#_getConnectionAsync()", function () {
		afterEach(function () {
			// Unlock the pane locked by recovery progress messages
			Zotero.hideZoteroPaneOverlays();
		});
		
		it("shouldn't treat an operational integrity-check error after an unclean shutdown as corruption", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			// Open through internal initialization so that the unclean-shutdown check runs
			db._externalDB = false;
			
			let stub = sinon.stub(db, 'valueQueryAsync');
			stub.callThrough();
			stub.withArgs("PRAGMA integrity_check(1)").rejects(new Error("disk I/O error"));
			try {
				let e = await getPromiseError(db.queryAsync("SELECT COUNT(*) FROM foo"));
				assert.include(e.message, "disk I/O error");
			}
			finally {
				stub.restore();
				await db.closeDatabase();
			}
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isFalse(await IOUtils.exists(dbPath + '.damaged'));
		});
	});
	

	describe("#_handleCorruptionMarker()", function () {
		afterEach(function () {
			// Unlock the pane locked by recovery progress messages
			Zotero.hideZoteroPaneOverlays();
		});
		
		// Create a database whose only damage is index inconsistencies -- an index built over
		// different values transplanted onto another table with the same row count -- which
		// fails a full integrity check but passes a quick check
		async function createDBWithIndexDamage(db, path, { unique = false, values = "(1), (2), (3)", dummyValues = "(4), (5), (6)" } = {}) {
			let connection = await db.Sqlite.openConnection({ path });
			try {
				await connection.execute("CREATE TABLE foo (a INTEGER)");
				await connection.execute(`INSERT INTO foo VALUES ${values}`);
				await connection.execute("CREATE TABLE dummy (a INTEGER)");
				await connection.execute(`INSERT INTO dummy VALUES ${dummyValues}`);
				await connection.execute(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX idx ON dummy(a)`);
				await connection.execute("PRAGMA writable_schema=ON");
				await connection.execute("UPDATE sqlite_master SET tbl_name='foo', "
					+ `sql='CREATE ${unique ? 'UNIQUE ' : ''}INDEX idx ON foo(a)' WHERE name='idx'`);
				await connection.execute("PRAGMA writable_schema=OFF");
			}
			finally {
				await connection.close();
			}
		}
		
		it("should repair a backup with index damage by rebuilding indexes on a copy", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await createDBWithIndexDamage(db, dbPath + '.bak');
			assert.isFalse(await db._integrityCheckFile(dbPath + '.bak'));
			assert.isTrue(await db._integrityCheckFile(dbPath + '.bak', true));
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 3);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			// Restored database should pass a full integrity check, with the backup and its
			// index damage left as is
			assert.isTrue(await db._integrityCheckFile(dbPath));
			assert.isFalse(await db._integrityCheckFile(dbPath + '.bak'));
			assert.isFalse(await IOUtils.exists(dbPath + '.bak.reindex.tmp'));
		});
		
		it("should create a new database if the backup's indexes can't be rebuilt", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			// Duplicate values in the table make rebuilding the unique index impossible
			await createDBWithIndexDamage(db, dbPath + '.bak', {
				unique: true, values: "(1), (1)", dummyValues: "(4), (5)"
			});
			assert.isFalse(await db._integrityCheckFile(dbPath + '.bak'));
			assert.isTrue(await db._integrityCheckFile(dbPath + '.bak', true));
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM sqlite_master"), 0);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			assert.isTrue(stub.called);
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged'));
			assert.isFalse(await IOUtils.exists(dbPath + '.bak.reindex.tmp'));
		});

		it("should abort recovery on an operational error during index rebuilding", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await createDBWithIndexDamage(db, dbPath + '.bak');
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			await Zotero.File.putContentsAsync(dbPath + '.is.corrupt', '');
			
			// Simulate a journal file of the reindex copy that can't be removed
			let stub = sinon.stub(db, '_removeJournalFiles');
			stub.callThrough();
			stub.withArgs(dbPath + '.bak.reindex.tmp').resolves(false);
			let alertStub = sinon.stub(Zotero, 'alert');
			try {
				let e = await getPromiseError(db._handleCorruptionMarker());
				assert.include(e.message, "reindex copy");
			}
			finally {
				stub.restore();
				alertStub.restore();
				await db.closeDatabase();
			}
			// No new database should have been created, and the backup, damaged files, and
			// corruption marker should remain for a retry
			assert.isFalse(await IOUtils.exists(dbPath));
			assert.isTrue(await IOUtils.exists(dbPath + '.bak'));
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged'));
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged-wal'));
			assert.isTrue(await IOUtils.exists(dbPath + '.is.corrupt'));
			assert.isTrue(alertStub.notCalled);
		});
		
		it("should move a stale WAL file to .damaged-wal when restoring from backup", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await IOUtils.copy(dbPath, dbPath + '.bak');
			
			// Simulate a corrupted database and a stale WAL file left behind by a force-quit
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				// Restored database should be usable
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 0);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			
			// Stale WAL file should have been moved alongside the .damaged file
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged'));
			assert.equal(await Zotero.File.getContentsAsync(dbPath + '.damaged-wal'), 'stale wal data');
			assert.isFalse(await IOUtils.exists(dbPath + '-wal'));
		});
		
		it("should keep a valid database file and remove a stale WAL file", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await IOUtils.copy(dbPath, dbPath + '.bak');
			
			// Add a row not in the backup, and simulate a stale WAL file next to the valid
			// database file
			await db.queryAsync("INSERT INTO foo VALUES (1)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			try {
				await db._handleCorruptionMarker();
				// Database file should be kept as is, not restored from the backup
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 1);
			}
			finally {
				await db.closeDatabase();
			}
			
			// Stale WAL file should have been removed, and no .damaged file created
			assert.isFalse(await IOUtils.exists(dbPath + '-wal'));
			assert.isFalse(await IOUtils.exists(dbPath + '.damaged'));
		});
		
		it("should keep a valid database file if an interrupted recovery already removed the journal files", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await IOUtils.copy(dbPath, dbPath + '.bak');
			// Newer data not in the backup, with no journal files left
			await db.queryAsync("INSERT INTO foo VALUES (1)");
			await db.closeDatabase();
			
			await db._handleCorruptionMarker();
			try {
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 1);
			}
			finally {
				await db.closeDatabase();
			}
			assert.isFalse(await IOUtils.exists(dbPath + '.damaged'));
		});
		
		it("should restore from backup if the database file was already moved by an interrupted recovery", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await IOUtils.copy(dbPath, dbPath + '.bak');
			await IOUtils.move(dbPath, dbPath + '.damaged');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 0);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			assert.isTrue(await IOUtils.exists(dbPath));
		});
		
		it("should create a new database if the backup is also corrupt", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			await Zotero.File.putContentsAsync(dbPath + '.bak', 'corrupted backup');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				// New empty database should have been created
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM sqlite_master"), 0);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			assert.isTrue(stub.called);
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged'));
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged-wal'));
			assert.isFalse(await IOUtils.exists(dbPath + '-wal'));
		});
		
		it("should create a new database if no backup exists", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await Zotero.File.putContentsAsync(dbPath, 'corrupted data');
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			let stub = sinon.stub(Zotero, 'alert');
			try {
				await db._handleCorruptionMarker();
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM sqlite_master"), 0);
			}
			finally {
				await db.closeDatabase();
				stub.restore();
			}
			assert.isTrue(stub.called);
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged'));
			assert.isTrue(await IOUtils.exists(dbPath + '.damaged-wal'));
			assert.isFalse(await IOUtils.exists(dbPath + '-wal'));
		});
	});
	

	describe("#_applyPendingRepair()", function () {
		afterEach(function () {
			// Unlock the pane locked by recovery progress messages
			Zotero.hideZoteroPaneOverlays();
		});
		
		it("should swap in a verified copy saved before a restart", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.queryAsync("INSERT INTO foo VALUES (1)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '-wal', 'stale wal data');
			
			// Save a verified copy, as _checkException() does before restarting
			assert.isTrue(await db._checkValidWithoutJournalFiles(true));
			assert.isTrue(await IOUtils.exists(dbPath + '.repair.tmp'));
			
			// Simulate the stale WAL data being checkpointed into the database file when the
			// connection is closed
			await Zotero.File.putContentsAsync(dbPath, 'poisoned data');
			
			// The verified copy should be swapped in
			await db._applyPendingRepair();
			try {
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 1);
			}
			finally {
				await db.closeDatabase();
			}
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp.verified'));
			assert.isFalse(await IOUtils.exists(dbPath + '-wal'));
		});
		
		it("should apply a valid repair file after rechecking if it doesn't match its verification record", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.queryAsync("INSERT INTO foo VALUES (1)");
			await db.closeDatabase();
			assert.isTrue(await db._checkValidWithoutJournalFiles(true));
			await Zotero.File.putContentsAsync(
				dbPath + '.repair.tmp.verified', JSON.stringify({ size: 1, lastModified: 1 })
			);
			await Zotero.File.putContentsAsync(dbPath, 'poisoned data');
			
			await db._applyPendingRepair();
			
			try {
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 1);
			}
			finally {
				await db.closeDatabase();
			}
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp.verified'));
		});
		
		it("should remove an invalid repair file that doesn't match its verification record", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			await Zotero.File.putContentsAsync(dbPath + '.repair.tmp', 'corrupted repair data');
			await Zotero.File.putContentsAsync(
				dbPath + '.repair.tmp.verified', JSON.stringify({ size: 1, lastModified: 1 })
			);
			
			await db._applyPendingRepair();
			
			// Repair file should have been rechecked, found invalid, and removed, with the
			// database file left in place
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp'));
			assert.isFalse(await IOUtils.exists(dbPath + '.repair.tmp.verified'));
			try {
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 0);
			}
			finally {
				await db.closeDatabase();
			}
		});
		
		it("should clean up leftover temporary files from interrupted checks", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			let suffixes = [
				'.check.tmp',
				'.check.tmp-wal',
				'.repair.tmp-wal',
				'.repair.tmp.verified',
				'.bak.reindex.tmp',
				'.bak.reindex.tmp-wal',
				'.bak.reindex.tmp-shm'
			];
			for (let suffix of suffixes) {
				await Zotero.File.putContentsAsync(dbPath + suffix, 'leftover data');
			}
			
			await db._applyPendingRepair();
			
			for (let suffix of suffixes) {
				assert.isFalse(await IOUtils.exists(dbPath + suffix), suffix);
			}
		});

		it("shouldn't apply a pending repair file for an external database", async function () {
			let dir = await getTempDirectory();
			let dbPath = PathUtils.join(dir, 'test.sqlite');
			let db = new Zotero.DBConnection(dbPath);
			await db.queryAsync("CREATE TABLE foo (a INT)");
			await db.closeDatabase();
			// Save a copy without the row added below
			await IOUtils.copy(dbPath, dbPath + '.repair.tmp');
			await db.queryAsync("INSERT INTO foo VALUES (1)");
			await db.closeDatabase();
			
			// On reopen, the repair file should be ignored
			try {
				assert.equal(await db.valueQueryAsync("SELECT COUNT(*) FROM foo"), 1);
			}
			finally {
				await db.closeDatabase();
			}
			assert.isTrue(await IOUtils.exists(dbPath + '.repair.tmp'));
		});
	});
	

	describe("#vacuum()", function () {
		it("should vacuum the database with force option", async function () {
			let result = await Zotero.DB.vacuum({ force: true });
			assert.isTrue(result);

			// DB should still be functional
			let count = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM items");
			assert.isNumber(count);

			// Vacuum timestamp should be updated
			assert.isAbove(Zotero.Prefs.get('vacuum.lastTime'), 0);

			// Temp file should be cleaned up
			assert.isFalse(await IOUtils.exists(Zotero.DB.path + '.vacuum.tmp'));
		});

		it("should skip vacuum when recently vacuumed", async function () {
			Zotero.Prefs.set('vacuum.lastTime', Math.floor(Date.now() / 1000));
			let result = await Zotero.DB.vacuum();
			assert.isFalse(result);
			Zotero.Prefs.clear('vacuum.lastTime');
		});

		it("should skip vacuum when freelist is below threshold", async function () {
			Zotero.Prefs.clear('vacuum.lastTime');
			Zotero.Prefs.set('vacuum.freelistThreshold', 99);
			let result = await Zotero.DB.vacuum();
			assert.isFalse(result);
			Zotero.Prefs.clear('vacuum.freelistThreshold');
		});
	});

	describe("#onConnect()", function () {
		it("should run registered callbacks after the connection is reopened", async function () {
			let count = 0;
			Zotero.DB.onConnect(async () => {
				count++;
			});
			await Zotero.DB.closeDatabase();
			await Zotero.DB.valueQueryAsync("SELECT 1");
			assert.equal(count, 1);
		});
	});
});
