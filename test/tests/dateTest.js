describe("Zotero.Date", function() {
	describe("#sqlToDate()", function () {
		it("should convert an SQL local date into a JS Date object", function* () {
			var date = "2016-02-27 22:00:00";
			var offset = new Date().getTimezoneOffset() * 60 * 1000;
			date = Zotero.Date.sqlToDate(date);
			assert.equal(date.getTime(), 1456610400000 + offset);
		})
		
		it("should convert an SQL UTC date into a JS Date object", function* () {
			var date = "2016-02-27 22:00:00";
			date = Zotero.Date.sqlToDate(date, true);
			assert.equal(date.getTime(), 1456610400000);
		})
	})
	
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
