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
	
	describe("#save()", function () {
		it("should trigger notifier event for inherited properties", function* () {
			var group = yield createGroup({
				editable: false
			});
			group.editable = true;
			
			var promise = waitForNotifierEvent('modify', 'group');
			yield group.saveTx();
			var data = yield promise;
			assert.lengthOf(data.ids, 1);
			assert.sameMembers(data.ids, [group.id]);
		});
	});
})
