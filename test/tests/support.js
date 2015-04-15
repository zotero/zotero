describe("Support Functions for Unit Testing", function() {
	describe("resetDB", function() {
		it("should restore the DB to factory settings", function* () {
			this.timeout(30000);
			yield Zotero.Items.erase(1);
			assert.isFalse(yield Zotero.Items.getAsync(1));
			yield resetDB();
			var item = yield Zotero.Items.getAsync(1);
			assert.isObject(item);
			yield item.loadItemData();
			assert.equal(item.getField("url"), "https://www.zotero.org/support/quick_start_guide");
		});
	});
});
