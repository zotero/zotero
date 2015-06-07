describe("Zotero.Groups", function () {
	describe("#get()", function () {
		it("should retrieve a newly created group", function* () {
			try {
				var group = yield createGroup();
				assert.equal(Zotero.Groups.get(group.id), group)
			}
			finally {
				if (group) {
					yield Zotero.DB.executeTransaction(function* () {
						return group.erase();
					})
				}
			}
		})
	})
})
