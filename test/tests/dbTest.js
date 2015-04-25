describe("Zotero.DB", function() {
	describe("#executeTransaction()", function () {
		it("should roll back on error", function* () {
			yield Zotero.DB.queryAsync("CREATE TABLE tmpRollbackOnError (foo INT)");
			yield Zotero.DB.queryAsync("INSERT INTO tmpRollbackOnError VALUES (1)");
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.queryAsync("INSERT INTO tmpRollbackOnError VALUES (2)");
					throw 'Aborting transaction -- ignore';
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			var count = yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM tmpRollbackOnError");
			assert.equal(count, 1);
			
			var conn = yield Zotero.DB._getConnectionAsync();
			assert.isFalse(conn.transactionInProgress);
			
			yield Zotero.DB.queryAsync("DROP TABLE tmpRollbackOnError");
		});
		
		it("should run onRollback callbacks", function* () {
			var callbackRan = false;
			yield Zotero.DB.queryAsync("CREATE TABLE tmpOnRollback (foo INT)");
			try {
				yield Zotero.DB.executeTransaction(
					function* () {
						yield Zotero.DB.queryAsync("INSERT INTO tmpOnRollback VALUES (1)");
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
			
			yield Zotero.DB.queryAsync("DROP TABLE tmpOnRollback");
		});
		
		it("should run onRollback callbacks for nested transactions", function* () {
			var callback1Ran = false;
			var callback2Ran = false;
			yield Zotero.DB.queryAsync("CREATE TABLE tmpOnNestedRollback (foo INT)");
			try {
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.DB.queryAsync("INSERT INTO tmpOnNestedRollback VALUES (1)");
					yield Zotero.DB.executeTransaction(
						function* () {
							yield Zotero.DB.queryAsync("INSERT INTO tmpOnNestedRollback VALUES (2)");
							
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
			
			yield Zotero.DB.queryAsync("DROP TABLE tmpOnNestedRollback");
		});
	})
});
