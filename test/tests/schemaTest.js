describe("Zotero.Schema", function() {
	describe("#initializeSchema()", function () {
		it("should set last client version", function* () {
			yield resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
			
			var sql = "SELECT value FROM settings WHERE setting='client' AND key='lastVersion'";
			var lastVersion = yield Zotero.DB.valueQueryAsync(sql);
			yield assert.eventually.equal(Zotero.DB.valueQueryAsync(sql), Zotero.version);
		});
	});
	
	describe("#updateSchema()", function () {
		it("should set last client version", function* () {
			var sql = "REPLACE INTO settings (setting, key, value) VALUES ('client', 'lastVersion', ?)";
			yield Zotero.DB.queryAsync(sql, "5.0old");
			
			yield Zotero.Schema.updateSchema();
			
			var sql = "SELECT value FROM settings WHERE setting='client' AND key='lastVersion'";
			var lastVersion = yield Zotero.DB.valueQueryAsync(sql);
			yield assert.eventually.equal(Zotero.DB.valueQueryAsync(sql), Zotero.version);
		});
	});
	
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
