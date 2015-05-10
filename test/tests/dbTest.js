describe("Zotero.DB", function() {
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
	
	describe("#executeTransaction()", function () {
		it("should serialize concurrent transactions", Zotero.Promise.coroutine(function* () {
			this.timeout(1000);
			
			var resolve1, resolve2, reject1, reject2;
			var promise1 = new Promise(function (resolve, reject) {
				resolve1 = resolve;
				reject1 = reject;
			});
			var promise2 = new Promise(function (resolve, reject) {
				resolve2 = resolve;
				reject2 = reject;
			});
			
			Zotero.DB.executeTransaction(function* () {
				yield Zotero.Promise.delay(250);
				var num = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 0);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve1)
			.catch(reject1);
			
			Zotero.DB.executeTransaction(function* () {
				var num = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 1);
				yield Zotero.Promise.delay(500);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve2)
			.catch(reject2);
			
			yield Zotero.Promise.all([promise1, promise2]);
		}));
		
		it("should serialize queued transactions", function* () {
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
			Zotero.DB.executeTransaction(function* () {
				yield Zotero.Promise.delay(100);
				var num = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 0);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve1)
			.catch(reject1);
			
			// Start two more transactions, which should wait on the first
			Zotero.DB.executeTransaction(function* () {
				var num = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 1);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve2)
			.catch(reject2);
			
			Zotero.DB.executeTransaction(function* () {
				var num = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
				assert.equal(num, 2);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (3)");
				// But make sure the second queued transaction doesn't start at the same time,
				// such that the first queued transaction gets closed while the second is still
				// running
				assert.ok(Zotero.DB.inTransaction());
			})
			.then(resolve3)
			.catch(reject3);
			
			yield Zotero.Promise.all([promise1, promise2, promise3]);
		})
		
		it("should roll back on error", function* () {
			yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
					throw 'Aborting transaction -- ignore';
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			var count = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable + "");
			assert.equal(count, 1);
			
			var conn = yield Zotero.DB._getConnectionAsync();
			assert.isFalse(conn.transactionInProgress);
			
			yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
		
		it("should run onRollback callbacks", function* () {
			var callbackRan = false;
			try {
				yield Zotero.DB.executeTransaction(
					function* () {
						yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
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
			
			yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
		
		it("should time out on nested transactions", function* () {
			var e;
			yield Zotero.DB.executeTransaction(function* () {
				e = yield getPromiseError(
					Zotero.DB.executeTransaction(function* () {}).timeout(250)
				);
			});
			assert.ok(e);
			assert.equal(e.name, "TimeoutError");
		});
		
		it("should run onRollback callbacks for timed-out nested transactions", function* () {
			var callback1Ran = false;
			var callback2Ran = false;
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.executeTransaction(
						function* () {},
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
});
