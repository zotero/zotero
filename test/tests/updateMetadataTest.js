describe('Update Metadata', function () {
	it('should disable all fields if potentially bad metadata is detected', function () {
		let itemTests = [
			// [oldItem, newItem, disabled?]
			[{ itemType: 'journalArticle' }, { itemType: 'webpage' }, true],
			[{ itemType: 'journalArticle', title: 'One title about something' }, { itemType: 'journalArticle', title: 'Another completely unrelated title' }, true],
			[{ itemType: 'journalArticle', title: 'This is the main title' }, { itemType: 'journalArticle', title: 'This is the main title: and subtitle' }, false]
		];

		for (let test of itemTests) {
			let oldItem = new Zotero.Item();
			let newItem = new Zotero.Item();
			oldItem.fromJSON(test[0]);
			newItem.fromJSON(test[1]);
			assert.equal(Zotero.UpdateMetadata.isMetadataDisabled(oldItem, newItem), test[2]);
		}
	});

	it('should disable some potentially worse field changes', function () {
		let fieldTests = [
			// [fieldType, oldValue, newValue, disabled?]
			['anyfield', 'any value', '', true],
			['callNumber', '111111111', '222222222', true]
		];

		for (let test of fieldTests) {
			assert.equal(Zotero.UpdateMetadata.isFieldDisabled(test[0], test[1], test[2]), test[3]);
		}
	});

	it('should ignore some potentially meaningless or worse field changes', function () {
		let fieldTests = [
			// [fieldType, oldValue, newValue, ignored?]
			['title', 'This is a title', 'THIS IS A TITLE', true],
			['title', 'This is a title', 'This Is a Title', true],
			['abstract', 'Abstract text', '', true],
			['accessDate', 'value1', 'value2', true]
		];

		for (let test of fieldTests) {
			assert.equal(Zotero.UpdateMetadata.isFieldIgnored(test[0], test[1], test[2]), test[3]);
		}
	});
});
