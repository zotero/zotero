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
		
		it("should throw an error if no parameters are passed for a query with placeholders", function* () {
			var e = yield getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?"));
			assert.ok(e);
			assert.include(e.message, "for query containing placeholders");
		})
		
		it("should throw an error if too few parameters are passed", function* () {
			var e = yield getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=? OR itemID=?", [1]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should throw an error if too many parameters are passed", function* () {
			var e = yield getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?", [1, 2]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should throw an error if too many parameters are passed for numbered placeholders", function* () {
			var e = yield getPromiseError(Zotero.DB.queryAsync("SELECT itemID FROM items WHERE itemID=?1 OR itemID=?1", [1, 2]));
			assert.ok(e);
			assert.include(e.message, "Incorrect number of parameters provided for query");
		})
		
		it("should accept a single placeholder given as a value", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", 2);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept a single placeholder given as an array", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", [2]);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept multiple placeholders", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=? OR b=?", [2, 4]);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 3);
		})
		
		it("should accept a single placeholder within parentheses", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?)", 2);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 1);
		})
		
		it("should accept multiple placeholders within parentheses", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?, ?)", [2, 4]);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 3);
		})
		
		it("should replace =? with IS NULL if NULL is passed as a value", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", null);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 5);
		})
		
		it("should replace =? with IS NULL if NULL is passed in an array", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?", [null]);
			assert.lengthOf(rows, 1);
			assert.equal(rows[0].a, 5);
		})
		
		it("should replace ? with NULL for placeholders within parentheses in INSERT statements", function* () {
			yield Zotero.DB.queryAsync("CREATE TEMPORARY TABLE tmp_srqwnfpwpinss (a, b)");
			// Replace ", ?"
			yield Zotero.DB.queryAsync("INSERT INTO tmp_srqwnfpwpinss (a, b) VALUES (?, ?)", [1, null]);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync("SELECT a FROM tmp_srqwnfpwpinss WHERE b IS NULL")),
				1
			);
			// Replace "(?"
			yield Zotero.DB.queryAsync("DELETE FROM tmp_srqwnfpwpinss");
			yield Zotero.DB.queryAsync("INSERT INTO tmp_srqwnfpwpinss (a, b) VALUES (?, ?)", [null, 2]);
			assert.equal(
				(yield Zotero.DB.valueQueryAsync("SELECT b FROM tmp_srqwnfpwpinss WHERE a IS NULL")),
				2
			);
			yield Zotero.DB.queryAsync("DROP TABLE tmp_srqwnfpwpinss");
		})
		
		it("should throw an error if NULL is passed for placeholder within parentheses in a SELECT statement", function* () {
			var e = yield getPromiseError(Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b IN (?)", null));
			assert.ok(e);
			assert.include(e.message, "NULL cannot be used for parenthesized placeholders in SELECT queries");
		})
		
		it("should handle numbered parameters", function* () {
			var rows = yield Zotero.DB.queryAsync("SELECT a FROM " + tmpTable + " WHERE b=?1 "
				+ "UNION SELECT b FROM " + tmpTable + " WHERE b=?1", 2);
			assert.lengthOf(rows, 2);
			assert.equal(rows[0].a, 1);
			assert.equal(rows[1].a, 2);
		})
		
		it("should throw an error if onRow throws an error", function* () {
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
			e = yield getPromiseError(e)
			assert.ok(e);
			assert.equal(e.message, "Failed");
		});
		
		it("should stop gracefully if onRow calls cancel()", function* () {
			var i = 0;
			var rows = [];
			yield Zotero.DB.queryAsync(
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
		it("should serialize concurrent transactions", Zotero.Promise.coroutine(function* () {
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
