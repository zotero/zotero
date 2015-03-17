describe("Support Functions for Unit Testing", function() {
	describe("resetDB", function() {
		it("should restore the DB to factory settings", function() {
			this.timeout(10000);
			var quickstart = Zotero.Items.erase(1);
			assert.equal(Zotero.Items.get(1), false);
			return resetDB().then(function() {
				assert.equal(Zotero.Items.get(1).getField("url"), "http://zotero.org/support/quick_start_guide");
			});
		});
	});
});
