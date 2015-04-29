describe("Zotero.Date", function() {
	describe("#isISODate()", function () {
		it("should determine whether a date is an ISO 8601 date", function () {
			assert.ok(Zotero.Date.isISODate("2015"));
			assert.ok(Zotero.Date.isISODate("2015-04"));
			assert.ok(Zotero.Date.isISODate("2015-04-29"));
			assert.ok(Zotero.Date.isISODate("2015-04-29T17:28Z"));
			assert.isFalse(Zotero.Date.isISODate("2015-04-29 17:28"));
		})
	})
})
