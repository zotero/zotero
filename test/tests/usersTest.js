describe("Zotero.Users", function () {
	describe("#setName()", function () {
		it("should restore the cached name if the transaction is rolled back", async function () {
			var userID = 24631244;
			await Zotero.Users.setName(userID, 'A');
			await executeTransactionWithForcedRollback(async function () {
				await Zotero.Users.setName(userID, 'B');
				assert.equal(Zotero.Users.getName(userID), 'B');
			});
			assert.equal(Zotero.Users.getName(userID), 'A');
			
			// A later save should write the new name to the database
			await Zotero.Users.setName(userID, 'B');
			assert.equal(
				await Zotero.DB.valueQueryAsync("SELECT name FROM users WHERE userID=?", userID),
				'B'
			);
		});
	});
});
