describe("Zotero.Item", function() {
	describe("#getField()", function () {
		it("should return false for valid unset fields on unsaved items", function* () {
			var item = new Zotero.Item('book');
			item.libraryID = Zotero.Libraries.userLibraryID;
			assert.equal(item.getField('rights'), false);
		});
		
		it("should return false for valid unset fields on unsaved items after setting on another field", function* () {
			var item = new Zotero.Item('book');
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.setField('title', 'foo');
			assert.equal(item.getField('rights'), false);
		});
		
		it("should return false for invalid unset fields on unsaved items after setting on another field", function* () {
			var item = new Zotero.Item('book');
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.setField('title', 'foo');
			assert.equal(item.getField('invalid'), false);
		});
	});
	
	describe("#parentID", function () {
		it("should create a child note", function () {
			return Zotero.DB.executeTransaction(function* () {
				var item = new Zotero.Item('book');
				item.libraryID = Zotero.Libraries.userLibraryID;
				var parentItemID = yield item.save();
				
				item = new Zotero.Item('note');
				item.libraryID = Zotero.Libraries.userLibraryID;
				item.parentID = parentItemID;
				var childItemID = yield item.save();
				
				item = yield Zotero.Items.getAsync(childItemID);
				Zotero.debug('=-=-=');
				Zotero.debug(item.parentID);
				assert.ok(item.parentID);
				assert.equal(item.parentID, parentItemID);
			}.bind(this));
		});
	});
});
