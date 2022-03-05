describe("Zotero.Utilities.Item", function() {
	describe("itemFromCSLJSON", function () {
		it("should stably perform itemToCSLJSON -> itemFromCSLJSON -> itemToCSLJSON", function* () {
			this.timeout(10000);
			let data = loadSampleData('citeProcJSExport');

			for (let i in data) {
				let json = data[i];

				// TEMP: https://github.com/zotero/zotero/issues/1667
				if (i == 'podcast') {
					delete json['collection-title'];
				}

				let item = new Zotero.Item();
				Zotero.Utilities.itemFromCSLJSON(item, json);
				yield item.saveTx();

				let newJSON = Zotero.Utilities.itemToCSLJSON(item);

				delete newJSON.id;
				delete json.id;

				assert.deepEqual(newJSON, json, i + ' export -> import -> export is stable');
			}

		});
		it("should recognize the legacy shortTitle key", function* () {
			this.timeout(20000);

			let data = loadSampleData('citeProcJSExport');

			var json = data.artwork;
			var canonicalKeys = Object.keys(json);
			json.shortTitle = json["title-short"];
			delete json["title-short"];

			let item = new Zotero.Item();
			Zotero.Utilities.itemFromCSLJSON(item, json);
			yield item.saveTx();

			let newJSON = Zotero.Utilities.itemToCSLJSON(item);
			assert.hasAllKeys(newJSON, canonicalKeys);
		});
		it("should import exported standalone note", function* () {
			let note = new Zotero.Item('note');
			note.setNote('Some note longer than 50 characters, which will become the title.');
			yield note.saveTx();

			let jsonNote = Zotero.Utilities.itemToCSLJSON(note);

			let item = new Zotero.Item();
			Zotero.Utilities.itemFromCSLJSON(item, jsonNote);

			assert.equal(item.getField('title'), jsonNote.title, 'title imported correctly');
		});
		it("should import exported standalone attachment", function* () {
			let attachment = yield importFileAttachment("empty.pdf");
			attachment.setField('title', 'Empty');
			attachment.setField('accessDate', '2001-02-03 12:13:14');
			attachment.setField('url', 'http://example.com');
			attachment.setNote('Note');
			yield attachment.saveTx();

			let jsonAttachment = Zotero.Utilities.itemToCSLJSON(attachment);

			let item = new Zotero.Item();
			Zotero.Utilities.itemFromCSLJSON(item, jsonAttachment);

			assert.equal(item.getField('title'), jsonAttachment.title, 'title imported correctly');
		});
		// For Zotero.Item created in translation sandbox in connectors
		it("should not depend on Zotero.Item existing", function* () {
			let item = new Zotero.Item;
			var Item = Zotero.Item;
			delete Zotero.Item;
			assert.throws(() => "" instanceof Zotero.Item);

			let data = loadSampleData('citeProcJSExport');
			assert.doesNotThrow(Zotero.Utilities.itemFromCSLJSON.bind(Zotero.Utilities, item, Object.values(data)[0]));

			Zotero.Item = Item;
			assert.doesNotThrow(() => "" instanceof Zotero.Item);
		})
	});

	describe("itemToCSLJSON", function() {
		it("should accept Zotero.Item and Zotero export item format", Zotero.Promise.coroutine(function* () {
			let data = yield populateDBWithSampleData(loadSampleData('journalArticle'));
			let item = yield Zotero.Items.getAsync(data.journalArticle.id);

			let fromZoteroItem;
			try {
				fromZoteroItem = Zotero.Utilities.itemToCSLJSON(item);
			} catch(e) {
				assert.fail(e, null, 'accepts Zotero Item');
			}
			assert.isObject(fromZoteroItem, 'converts Zotero Item to object');
			assert.isNotNull(fromZoteroItem, 'converts Zotero Item to non-null object');


			let fromExportItem;
			try {
				fromExportItem = Zotero.Utilities.itemToCSLJSON(
					Zotero.Utilities.Internal.itemToExportFormat(item)
				);
			} catch(e) {
				assert.fail(e, null, 'accepts Zotero export item');
			}
			assert.isObject(fromExportItem, 'converts Zotero export item to object');
			assert.isNotNull(fromExportItem, 'converts Zotero export item to non-null object');

			assert.deepEqual(fromZoteroItem, fromExportItem, 'conversion from Zotero Item and from export item are the same');
		}));
		it("should convert standalone notes to expected format", Zotero.Promise.coroutine(function* () {
			let note = new Zotero.Item('note');
			note.setNote('Some note longer than 50 characters, which will become the title.');
			yield note.saveTx();

			let cslJSONNote = Zotero.Utilities.itemToCSLJSON(note);
			assert.equal(cslJSONNote.type, 'document', 'note is exported as "document"');
			assert.equal(cslJSONNote.title, note.getNoteTitle(), 'note title is set to Zotero pseudo-title');
		}));
		it("should convert standalone attachments to expected format", Zotero.Promise.coroutine(function* () {
			let file = getTestDataDirectory();
			file.append("empty.pdf");

			let attachment = yield Zotero.Attachments.importFromFile({"file":file});
			attachment.setField('title', 'Empty');
			attachment.setField('accessDate', '2001-02-03 12:13:14');
			attachment.setField('url', 'http://example.com');
			attachment.setNote('Note');

			yield attachment.saveTx();

			let cslJSONAttachment = Zotero.Utilities.itemToCSLJSON(attachment);
			assert.equal(cslJSONAttachment.type, 'document', 'attachment is exported as "document"');
			assert.equal(cslJSONAttachment.title, 'Empty', 'attachment title is correct');
			assert.deepEqual(cslJSONAttachment.accessed, {"date-parts":[["2001",2,3]]}, 'attachment access date is mapped correctly');
		}));
		it("should refuse to convert unexpected item types", Zotero.Promise.coroutine(function* () {
			let data = yield populateDBWithSampleData(loadSampleData('journalArticle'));
			let item = yield Zotero.Items.getAsync(data.journalArticle.id);

			let exportFormat = Zotero.Utilities.Internal.itemToExportFormat(item);
			exportFormat.itemType = 'foo';

			assert.throws(Zotero.Utilities.itemToCSLJSON.bind(Zotero.Utilities, exportFormat), /^Unexpected Zotero Item type ".*"$/, 'throws an error when trying to map invalid item types');
		}));

		it("should parse particles in creator names", function* () {
			let creators = [
				{
					// No particles
					firstName: 'John',
					lastName: 'Smith',
					creatorType: 'author',
					expect: {
						given: 'John',
						family: 'Smith'
					}
				},
				{
					// dropping and non-dropping
					firstName: 'Jean de',
					lastName: 'la Fontaine',
					creatorType: 'author',
					expect: {
						given: 'Jean',
						"dropping-particle": 'de',
						"non-dropping-particle": 'la',
						family: 'Fontaine'
					}
				},
				{
					// only non-dropping
					firstName: 'Vincent',
					lastName: 'van Gogh',
					creatorType: 'author',
					expect: {
						given: 'Vincent',
						"non-dropping-particle": 'van',
						family: 'Gogh'
					}
				},
				{
					// only dropping
					firstName: 'Alexander von',
					lastName: 'Humboldt',
					creatorType: 'author',
					expect: {
						given: 'Alexander',
						"dropping-particle": 'von',
						family: 'Humboldt'
					}
				},
				{
					// institutional author
					lastName: 'Jean de la Fontaine',
					creatorType: 'author',
					fieldMode: 1,
					expect: {
						literal: 'Jean de la Fontaine'
					}
				},
				{
					// protected last name
					firstName: 'Jean de',
					lastName: '"la Fontaine"',
					creatorType: 'author',
					expect: {
						given: 'Jean de',
						family: 'la Fontaine'
					}
				}
			];

			let data = yield populateDBWithSampleData({
				item: {
					itemType: 'journalArticle',
					creators: creators
				}
			});

			let item = Zotero.Items.get(data.item.id);
			let cslCreators = Zotero.Utilities.itemToCSLJSON(item).author;

			assert.deepEqual(cslCreators[0], creators[0].expect, 'simple name is not parsed');
			assert.deepEqual(cslCreators[1], creators[1].expect, 'name with dropping and non-dropping particles is parsed');
			assert.deepEqual(cslCreators[2], creators[2].expect, 'name with only non-dropping particle is parsed');
			assert.deepEqual(cslCreators[3], creators[3].expect, 'name with only dropping particle is parsed');
			assert.deepEqual(cslCreators[4], creators[4].expect, 'institutional author is not parsed');
			assert.deepEqual(cslCreators[5], creators[5].expect, 'protected last name prevents parsing');
		});

		it("should convert UTC access date to local time", async function () {
			var offset = new Date().getTimezoneOffset();
			var item = new Zotero.Item('webpage');
			var localDate;
			if (offset < 0) {
				localDate = '2019-01-09 00:00:00';
			}
			else if (offset > 0) {
				localDate = '2019-01-09 23:59:59';
			}
			// Can't test timezone offset if in UTC
			else {
				this.skip();
				return;
			}
			var utcDate = Zotero.Date.sqlToDate(localDate);
			item.setField('accessDate', Zotero.Date.dateToSQL(utcDate, true));
			await item.saveTx();
			let accessed = Zotero.Utilities.itemToCSLJSON(item).accessed;

			assert.equal(accessed['date-parts'][0][0], 2019);
			assert.equal(accessed['date-parts'][0][1], 1);
			assert.equal(accessed['date-parts'][0][2], 9);
		});
	});
	
	
	describe("#noteToTitle()", function () {
		it("should stop after first block element with content", async function () {
			var str = "<h1>Foo</h1><p>Bar</p>";
			var title = Zotero.Utilities.Item.noteToTitle(str, { stopAtLineBreak: true });
			assert.equal(title, 'Foo');
		});
		
		it("should skip first line if no content", async function () {
			var str = "<blockquote>\n<p>Foo</p>\n</blockquote>\n<p>Bar</p>";
			var title = Zotero.Utilities.Item.noteToTitle(str);
			assert.equal(title, 'Foo');
		});
		
		it("should stop at <br/> when options.stopAtLineBreak is true", async function () {
			var str = "<h1>Annotations<br/>(2/18/2022, 3:49:43 AM)</h1><p>Foo</p>";
			var title = Zotero.Utilities.Item.noteToTitle(str, { stopAtLineBreak: true });
			assert.equal(title, 'Annotations');
		});
	});
});
