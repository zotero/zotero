describe("Zotero.Date", function() {
	describe("#sqlToDate()", function () {
		it("should convert an SQL local date into a JS Date object", function* () {
			var d1 = new Date();
			var sqlDate = d1.getFullYear()
				+ '-'
				+ Zotero.Utilities.lpad(d1.getMonth() + 1, '0', 2)
				+ '-'
				+ Zotero.Utilities.lpad(d1.getDate(), '0', 2)
				+ ' '
				+ Zotero.Utilities.lpad(d1.getHours(), '0', 2)
				+ ':'
				+ Zotero.Utilities.lpad(d1.getMinutes(), '0', 2)
				+ ':'
				+ Zotero.Utilities.lpad(d1.getSeconds(), '0', 2);
			var offset = d1.getTimezoneOffset() * 60 * 1000;
			var d2 = Zotero.Date.sqlToDate(sqlDate);
			assert.equal(
				Zotero.Date.sqlToDate(sqlDate).getTime(),
				Math.floor(new Date().getTime() / 1000) * 1000
			);
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
