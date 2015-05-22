describe("Zotero.Groups", function () {
	describe("#get()", function () {
		it("should retrieve a newly created group", function* () {
			var group = new Zotero.Group;
			group.id = 1851251;
			group.libraryID = yield Zotero.ID.get('libraries');
			group.name = "Test";
			group.description = "";
			group.editable = true;
			group.filesEditable = true;
			group.version = 1234;
			try {
				yield group.save();
				assert.equal(Zotero.Groups.get(1851251), group)
			}
			finally {
				if (group) {
					yield group.erase();
				}
			}
		})
	})
})
