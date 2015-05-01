describe("Zotero.DB", function() {
	describe("#executeTransaction()", function () {
		it("should nest concurrent transactions", Zotero.Promise.coroutine(function* () {
			var tmpTable = "tmpWaitForTransactions";
			yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
			
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
				yield Zotero.Promise.delay(100);
				assert.equal(Zotero.DB._asyncTransactionNestingLevel, 0);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
				// Make sure we're still in a transaction
				Zotero.DB.transactionDate;
			})
			.then(resolve1)
			.catch(reject1);
			
			Zotero.DB.executeTransaction(function* () {
				assert.equal(Zotero.DB._asyncTransactionNestingLevel, 1);
				yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
				// Make sure we're still in a transaction
				Zotero.DB.transactionDate;
			})
			.then(resolve2)
			.catch(reject2);
			
			yield Zotero.Promise.all([promise1, promise2]);
		}));
		
		it("should roll back on error", function* () {
			var tmpTable = "tmpRollbackOnError";
			yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
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
			var tmpTable = "tmpOnRollback";
			var callbackRan = false;
			yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
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
		
		it("should run onRollback callbacks for nested transactions", function* () {
			var tmpTable = "tmpOnNestedRollback";
			var callback1Ran = false;
			var callback2Ran = false;
			yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
					yield Zotero.DB.executeTransaction(
						function* () {
							yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
							
							throw 'Aborting transaction -- ignore';
						},
						{
							onRollback: function () {
								callback1Ran = true;
							}
						}
					);
				},
				{
					onRollback: function () {
						callback2Ran = true;
					}
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			assert.ok(callback1Ran);
			assert.ok(callback2Ran);
			
			yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
		
		it("should not commit nested transactions", function* () {
			var tmpTable = "tmpNoCommitNested";
			yield Zotero.DB.queryAsync("CREATE TABLE " + tmpTable + " (foo INT)");
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (1)");
					yield Zotero.DB.executeTransaction(function* () {
						yield Zotero.DB.queryAsync("INSERT INTO " + tmpTable + " VALUES (2)");
						throw 'Aborting transaction -- ignore';
					});
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			var count = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM " + tmpTable);
			assert.equal(count, 0);
			
			yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
		});
	})
});
