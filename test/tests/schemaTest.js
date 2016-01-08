describe("Zotero.Schema", function() {
	describe("#integrityCheck()", function () {
		before(function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
		})
		
		it("should repair a foreign key violation", function* () {
			yield assert.eventually.isTrue(Zotero.Schema.integrityCheck());
			
			yield Zotero.DB.queryAsync("PRAGMA foreign_keys = OFF");
			yield Zotero.DB.queryAsync("INSERT INTO itemTags VALUES (1234,1234,0)");
			yield Zotero.DB.queryAsync("PRAGMA foreign_keys = ON");
			
			yield assert.eventually.isFalse(Zotero.Schema.integrityCheck());
			yield assert.eventually.isTrue(Zotero.Schema.integrityCheck(true));
			yield assert.eventually.isTrue(Zotero.Schema.integrityCheck());
		})
	})
})
