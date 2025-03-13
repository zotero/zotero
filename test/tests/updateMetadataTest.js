describe('Update Metadata', function () {
	function getFields(oldItem, newItem) {
		let row = {
			itemID: oldItem.id,
			status: Zotero.UpdateMetadata.ROW_QUEUED,
			message: '',
			title: oldItem.getField('title', false, true),
			fields: [],
			accepted: {},
			isDone: false
		};
		Zotero.UpdateMetadata._setRowFields(row, oldItem, newItem);
		return row.fields;
	}

	it('should disable all fields if potentially bad metadata is detected', function () {
		let itemTests = [
			// [oldItem, newItem, disabled?]
			[{ itemType: 'journalArticle' }, { itemType: 'webpage' }, true],
			[{ itemType: 'journalArticle', title: 'One title about something' }, { itemType: 'journalArticle', title: 'Another completely unrelated title' }, true],
			[{ itemType: 'journalArticle', title: 'This is the main title' }, { itemType: 'journalArticle', title: 'This is the main title: and subtitle' }, false],
			[{ itemType: 'journalArticle', extra: 'arXiv: abcdef' }, { itemType: 'journalArticle', DOI: 'something with arXiv in it' }, true],
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
			['callNumber', '111111111', '222222222', true],
			['ISSN', '0921-5158', '09215158', true],
			['ISBN', 'an invalid ISBN', '978-3-86894-326-9', false],
			['date', '2021-05-25T07:10:15.415Z', '2021-05-25', true]
		];

		for (let test of fieldTests) {
			assert.equal(Zotero.UpdateMetadata.isFieldDisabled(test[0], test[1], test[2]), test[3]);
		}
	});

	it('should leave emptied Extra enabled when updating a now-published preprint', function () {
		let fieldTests = [
			// [fieldType, oldValue, newValue, itemProps, disabled?]
			['extra', 'arXiv: 1301.0511', '', { isNewlyPublished: true }, false],
			['extra', 'arXiv ID: 1301.0511', '', { isNewlyPublished: true }, false],
			['extra', 'arXiv: XYZ\nKey: Value', 'Key: Value', { isNewlyPublished: true }, false],
			['extra', 'arXiv: 1301.0511', '', { isNewlyPublished: false }, true],
			['extra', 'arXiv: 1301.0511', '', {}, true]
		];

		for (let test of fieldTests) {
			assert.equal(
				Zotero.UpdateMetadata.isFieldDisabled(test[0], test[1], test[2], test[3]),
				test[4]);
		}
	});

	it('should ignore some potentially meaningless or worse field changes', function () {
		let fieldTests = [
			// [fieldType, oldValue, newValue, ignored?]
			['title', 'This is a title', 'THIS IS A TITLE', true],
			['title', 'This is a title', 'This Is a Title', true],
			['abstract', 'Abstract text', '', true],
			['accessDate', 'value1', 'value2', true],
			['url', 'https://www.jstor.org/stable/2501300', 'https://www.jstor.org/stable/2501300?origin=crossref', true]
		];

		for (let test of fieldTests) {
			assert.equal(Zotero.UpdateMetadata.isFieldIgnored(test[0], test[1], test[2]), test[3]);
		}
	});

	it('shouldn\'t ignore accessDate when updating a preprint to a published paper', function () {
		let fieldTests = [
			// [fieldType, oldValue, newValue, ignored?]
			['accessDate', 'value1', 'value2', { isNewlyPublished: true }, false],
			['accessDate', 'value1', 'value2', { isNewlyPublished: false }, true]
		];

		for (let test of fieldTests) {
			assert.equal(
				Zotero.UpdateMetadata.isFieldIgnored(test[0], test[1], test[2], test[3]),
				test[4]);
		}
	});

	it('should combine Extra fields, keeping all non-key-value lines', function () {
		let extraTests = [
			// [oldExtra, newExtra, mergedExtra]
			['Publisher: Pearson', '', 'Publisher: Pearson'],
			['', 'Publisher: Pearson', 'Publisher: Pearson'],
			['Publisher: Pearson\npublicationTitle: Test', 'Publisher: Random House', 'Publication Title: Test\nPublisher: Random House'],
			['Publisher: Unknown\nSome non-KV data', 'Publication Title: Words\nDifferent non-KV data', 'Publication Title: Words\nPublisher: Unknown\nSome non-KV data\nDifferent non-KV data'],
			['Page Version ID: 1045159392', 'Page Version ID: 1055431932', 'Page Version ID: 1055431932'],
			['Publication Title: Test\nFake Metadata: 0', 'Fake Metadata: 1', 'Publication Title: Test\nFake Metadata: 1']
		];

		for (let test of extraTests) {
			assert.equal(Zotero.UpdateMetadata.combineExtra(test[0], test[1]), test[2]);
		}
	});

	it('should include creator types in labels when different', function () {
		let oldItem = new Zotero.Item('book');
		oldItem.setCreator(0, {
			firstName: 'John',
			lastName: 'Doe',
			creatorType: 'author'
		});

		let newItem = {
			itemType: 'book',
			creators: [{
				firstName: 'John',
				lastName: 'Doe',
				creatorType: 'editor'
			}]
		};

		let fields = getFields(oldItem, newItem);
		let creators = fields.find(field => field.fieldName === 'creators');
		assert.ok(creators);
		assert.include(creators.oldLabel, '(Author)');
		assert.include(creators.newLabel, '(Editor)');
	});

	it('should not include creator types in labels when identical', function () {
		let oldItem = new Zotero.Item('book');
		oldItem.setCreator(0, {
			firstName: 'John',
			lastName: 'Doe',
			creatorType: 'author'
		});
		oldItem.setCreator(1, {
			firstName: 'John',
			lastName: 'Smith',
			creatorType: 'author'
		});

		let newItem = {
			itemType: 'book',
			creators: [{
				firstName: 'John',
				lastName: 'Doe',
				creatorType: 'author'
			}]
		};

		let fields = getFields(oldItem, newItem);
		let creators = fields.find(field => field.fieldName === 'creators');
		assert.ok(creators);
		assert.notInclude(creators.oldLabel, '(');
		assert.notInclude(creators.newLabel, '(');
	});
});
