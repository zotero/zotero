describe("Zotero.Groups", function () {
	describe("#get()", function () {
		it("should retrieve a newly created group", async function () {
			try {
				var group = await createGroup();
				assert.equal(Zotero.Groups.get(group.id), group)
			}
			finally {
				if (group) {
					await Zotero.DB.executeTransaction(async function () {
						return group.erase();
					})
				}
			}
		})
	})
	
	describe("#save()", function () {
		it("should trigger notifier event for inherited properties", async function () {
			var group = await createGroup({
				editable: false
			});
			group.editable = true;
			
			var promise = waitForNotifierEvent('modify', 'group');
			await group.saveTx();
			var data = await promise;
			assert.lengthOf(data.ids, 1);
			assert.sameMembers(data.ids, [group.id]);
		});
	});
})
