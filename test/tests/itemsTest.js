describe("Zotero.Items", function() {
	describe("#getLibraryAndKeyFromID()", function () {
		it("should return a libraryID and key within a transaction", function* () {
			return Zotero.DB.executeTransaction(function* () {
				var item = new Zotero.Item('book');
				var itemID = yield item.save();
				
				var {libraryID, key} = Zotero.Items.getLibraryAndKeyFromID(itemID);
				assert.equal(libraryID, Zotero.Libraries.userLibraryID);
				assert.ok(key);
				assert.typeOf(key, 'string');
				assert.equal(key, item.key);
			});
		});
		
		it("should return false after a save failure", function* () {
			var itemID;
			try {
				yield Zotero.DB.executeTransaction(function* () {
					var item = new Zotero.Item('book');
					itemID = yield item.save();
					throw 'Aborting transaction -- ignore';
				});
			}
			catch (e) {
				if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
			}
			
			// The registered identifiers should be reset in a rollback handler
			var libraryKey = Zotero.Items.getLibraryAndKeyFromID(itemID);
			assert.isFalse(libraryKey);
		});
	});
});
