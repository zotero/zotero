"use strict";

describe("Zotero.SearchQuery", function () {
	function clauses(query) {
		let { tree } = Zotero.SearchQuery.parse(query);
		return tree ? tree.children : [];
	}

	describe("#parse()", function () {
		it("should parse a field, operator, and value", function () {
			let { tree, text } = Zotero.SearchQuery.parse("by:smith");
			assert.equal(text, "");
			assert.deepEqual(tree.children, [
				{ condition: 'creator', operator: 'contains', value: 'smith' }
			]);
		});

		it("should separate free text from clauses, in either order", function () {
			let { tree, text } = Zotero.SearchQuery.parse("by:smith crispr screens");
			assert.equal(text, "crispr screens");
			assert.lengthOf(tree.children, 1);
			assert.equal(Zotero.SearchQuery.parse("crispr by:smith").text, "crispr");
		});

		it("should treat text that only looks like a clause as text", function () {
			for (let query of ["10.1234/foo:bar", "Vol 2: The Return", "https://example.com/a:b"]) {
				let { tree, text } = Zotero.SearchQuery.parse(query);
				assert.isNull(tree, query);
				assert.equal(text, query.replace(/\s+/g, ' '), query);
			}
		});
	});

	describe("operators and comparisons", function () {
		it("should accept operator words as the Advanced Search reads", function () {
			assert.deepEqual(clauses("title is grounded"), [
				{ condition: 'title', operator: 'is', value: 'grounded' }
			]);
			assert.deepEqual(clauses("date before 2015"), [
				{ condition: 'date', operator: 'isBefore', value: '2015' }
			]);
			assert.deepEqual(clauses("year since 2020"), [
				{ condition: 'date', operator: 'isAfter', value: '2020' }
			]);
			// Every date-type field compares as a date
			assert.deepEqual(clauses("filing date is before 2020"), [
				{ condition: 'filingDate', operator: 'isBefore', value: '2020' }
			]);
			assert.deepEqual(clauses("original date is before 2020"), [
				{ condition: 'originalDate', operator: 'isBefore', value: '2020' }
			]);
		});

		it("should parse an operator of several words, preferring the longest", function () {
			assert.deepEqual(clauses("title begins with grounded"), [
				{ condition: 'title', operator: 'beginsWith', value: 'grounded' }
			]);
			assert.deepEqual(clauses("type is not book"), [
				{ condition: 'itemType', operator: 'isNot', value: 'book' }
			]);
		});

		it("should compare dates with before, after, and since as fields", function () {
			assert.deepEqual(clauses("after:2020"), [
				{ condition: 'date', operator: 'isAfter', value: '2020' }
			]);
			assert.deepEqual(clauses("before:2015"), [
				{ condition: 'date', operator: 'isBefore', value: '2015' }
			]);
		});

		it("should keep the unit in a relative date", async function () {
			assert.deepEqual(clauses("added in the last 3 days"), [
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '3 days' }
			]);
			assert.equal(Zotero.SearchQuery.parse("added in the last 3 days").text, "");

			let item = await createDataObject('item');
			let search = Zotero.SearchQuery.getSearch("added in the last 3 days", {
				libraryID: Zotero.Libraries.userLibraryID
			});
			assert.include(await search.search(), item.id);
		});

		it("should count weeks in days, which the date comparison understands", function () {
			assert.deepEqual(clauses("added in the last 2 weeks"), [
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '14 days' }
			]);
		});

		it("should read natural comparisons written with 'is'", function () {
			assert.deepEqual(clauses("year is before 2020"), [
				{ condition: 'date', operator: 'isBefore', value: '2020' }
			]);
			assert.deepEqual(clauses("added is in the last 2 weeks"), [
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '14 days' }
			]);
			assert.deepEqual(clauses("number of tags is greater than 5"), [
				{ condition: 'numTags', operator: 'isGreaterThan', value: '5' }
			]);
			// A condition that doesn't compare still matches the word
			assert.deepEqual(clauses("title is before"), [
				{ condition: 'title', operator: 'is', value: 'before' }
			]);
		});

		it("should accept 'starts with' and 'within the last'", function () {
			assert.deepEqual(clauses("title starts with grounded"), [
				{ condition: 'title', operator: 'beginsWith', value: 'grounded' }
			]);
			assert.deepEqual(clauses("added within the last 3 days"), [
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '3 days' }
			]);
		});

		it("should compare numbers", function () {
			assert.deepEqual(clauses("number of tags > 5"), [
				{ condition: 'numTags', operator: 'isGreaterThan', value: '5' }
			]);
			assert.deepEqual(clauses("number of notes greater than 2"), [
				{ condition: 'numNotes', operator: 'isGreaterThan', value: '2' }
			]);
		});

		it("should read a colon after a word operator as punctuation", function () {
			assert.deepEqual(clauses("year before:2020"), [
				{ condition: 'date', operator: 'isBefore', value: '2020' }
			]);
			assert.deepEqual(clauses("year is before:2020"), [
				{ condition: 'date', operator: 'isBefore', value: '2020' }
			]);
			assert.deepEqual(clauses("tag is:foo"), [
				{ condition: 'tag', operator: 'is', value: 'foo' }
			]);
		});

		it("should support empty and non-empty conditions", function () {
			assert.deepEqual(clauses("creator is empty"), [
				{ condition: 'creator', operator: 'isEmpty', value: '' }
			]);
			assert.deepEqual(clauses("abstract is not empty"), [
				{ condition: 'abstractNote', operator: 'isNotEmpty', value: '' }
			]);
		});
	});

	describe("ranges", function () {
		// The comparisons are exclusive, so a range that takes in 1970 and
		// 2000 is written as after 1969 and before 2001
		let years = {
			joinMode: 'all',
			children: [
				{ condition: 'date', operator: 'isAfter', value: '1969' },
				{ condition: 'date', operator: 'isBefore', value: '2001' }
			]
		};

		it("should read a range as the comparisons that bracket it", function () {
			assert.deepEqual(clauses("year is between 1970 and 2000"), [years]);
			assert.deepEqual(clauses("year between 1970 and 2000"), [years]);
		});

		it("should accept a range written without a word between the ends", function () {
			let queries = [
				"year:1970-2000",
				"year is 1970-2000",
				"year:1970..2000",
				"year:1970 to 2000",
				"year:1970 - 2000",
				"year:1970–2000"
			];
			for (let query of queries) {
				assert.deepEqual(clauses(query), [years], query);
			}
		});

		it("should step a range end by however much it was written with", function () {
			assert.deepEqual(clauses("added between 2024-02 and 2024-06"), [{
				joinMode: 'all',
				children: [
					{ condition: 'dateAdded', operator: 'isAfter', value: '2024-01' },
					{ condition: 'dateAdded', operator: 'isBefore', value: '2024-07' }
				]
			}]);
			assert.deepEqual(clauses("date:2020-03-01..2020-03-15"), [{
				joinMode: 'all',
				children: [
					{ condition: 'date', operator: 'isAfter', value: '2020-02-29' },
					{ condition: 'date', operator: 'isBefore', value: '2020-03-16' }
				]
			}]);
		});

		it("should compare counts as numbers", function () {
			assert.deepEqual(clauses("number of tags between 2 and 5"), [{
				joinMode: 'all',
				children: [
					{ condition: 'numTags', operator: 'isGreaterThan', value: '1' },
					{ condition: 'numTags', operator: 'isLessThan', value: '6' }
				]
			}]);
		});

		it("should match either end when a range is excluded", function () {
			assert.deepEqual(clauses("year is not between 1970 and 2000"), [{
				joinMode: 'any',
				children: [
					{ condition: 'date', operator: 'isBefore', value: '1970' },
					{ condition: 'date', operator: 'isAfter', value: '2000' }
				]
			}]);
		});

		it("should read a value that isn't a range as a value", function () {
			// A date of its own, a range a condition that doesn't compare
			// can't take, a quoted value, and ends in the wrong order
			assert.deepEqual(clauses("date:2020-01-05"), [
				{ condition: 'date', operator: 'is', value: '2020-01-05' }
			]);
			assert.deepEqual(clauses("title:1970-2000"), [
				{ condition: 'title', operator: 'contains', value: '1970-2000' }
			]);
			assert.deepEqual(clauses('year:"1970-2000"'), [
				{ condition: 'date', operator: 'is', value: '1970-2000' }
			]);
			assert.deepEqual(clauses("year:2000-1970"), [
				{ condition: 'date', operator: 'is', value: '2000-1970' }
			]);
			// `and` joins clauses, so it separates ends only after `between`
			assert.deepEqual(clauses("year:1970 and tag:foo"), [
				{ condition: 'date', operator: 'is', value: '1970' },
				{ condition: 'tag', operator: 'is', value: 'foo' }
			]);
			// Each separator goes with the form it belongs to
			assert.isNull(Zotero.SearchQuery.parse("year is between 1970 to 2000").tree);
		});

		it("should scope a range on a child field to one child", function () {
			// Both ends are about the same attachment, so the level scopes the
			// pair rather than each comparison
			assert.deepEqual(clauses("attachment last read between 2020 and 2025"), [{
				joinMode: 'all',
				level: 'attachment',
				children: [
					{ condition: 'lastRead', operator: 'isAfter', value: '2019' },
					{ condition: 'lastRead', operator: 'isBefore', value: '2026' }
				]
			}]);
		});

		it("should match a child in the range, not one at each end", async function () {
			let read = async (parent, year) => {
				let attachment = await importFileAttachment('test.pdf', { parentItemID: parent.id });
				attachment.attachmentLastRead = Math.floor(Date.UTC(year, 5, 15) / 1000);
				await attachment.saveTx();
			};
			let inRange = await createDataObject('item');
			await read(inRange, 2022);
			let straddling = await createDataObject('item');
			await read(straddling, 2010);
			await read(straddling, 2030);

			let ids = await Zotero.SearchQuery.getSearch(
				"attachment last read between 2020 and 2025",
				{ libraryID: Zotero.Libraries.userLibraryID }
			).search();
			assert.include(ids, inRange.id);
			assert.notInclude(ids, straddling.id);
		});

		it("should repeat the field of a range for a value after 'or'", function () {
			assert.deepEqual(clauses("year:2020-2025 or 1999"), [
				{
					joinMode: 'all',
					children: [
						{ condition: 'date', operator: 'isAfter', value: '2019' },
						{ condition: 'date', operator: 'isBefore', value: '2026' }
					]
				},
				{ condition: 'date', operator: 'is', value: '1999' }
			]);
		});

		it("should read a day the month doesn't have as a value", function () {
			// Stepping past the end of the month would widen the range into
			// the month after it
			assert.deepEqual(clauses("date:2023-02-29..2023-02-29"), [
				{ condition: 'date', operator: 'is', value: '2023-02-29..2023-02-29' }
			]);
			// A day the month does have still reads as a range
			assert.deepEqual(clauses("date:2024-02-29..2024-02-29"), [{
				joinMode: 'all',
				children: [
					{ condition: 'date', operator: 'isAfter', value: '2024-02-28' },
					{ condition: 'date', operator: 'isBefore', value: '2024-03-01' }
				]
			}]);
		});

		it("should recognize a range before both ends are typed", function () {
			let queries = [
				"year is between",
				"year is between 19",
				"year is between 1970 and",
				"year is between 1970 and 19"
			];
			for (let query of queries) {
				// Nothing to match on yet, and not text to search for
				let { tree, text } = Zotero.SearchQuery.parse("crispr " + query);
				assert.isNull(tree, query);
				assert.equal(text, "crispr", query);
				// Every character still belongs to a token, for highlighting
				let tokens = Zotero.SearchQuery.tokenize(query);
				assert.equal(tokens[tokens.length - 1].end, query.length, query);
			}
		});

		it("should find items dated anywhere in the range, ends included", async function () {
			let items = {};
			for (let date of ['1969', '1970', '1985-06-15', '2000-12-31', '2001']) {
				items[date] = await createDataObject('item', { setTitle: true });
				items[date].setField('date', date);
				await items[date].saveTx();
			}

			for (let query of ["year is between 1970 and 2000", "year:1970-2000"]) {
				let search = Zotero.SearchQuery.getSearch(query, {
					libraryID: Zotero.Libraries.userLibraryID
				});
				let ids = await search.search();
				assert.include(ids, items['1970'].id, query);
				assert.include(ids, items['1985-06-15'].id, query);
				assert.include(ids, items['2000-12-31'].id, query);
				assert.notInclude(ids, items['1969'].id, query);
				assert.notInclude(ids, items['2001'].id, query);
			}
		});
	});

	describe("grouping and precedence", function () {
		it("should group with parentheses and join modes", function () {
			let { tree } = Zotero.SearchQuery.parse('by:smith and (tag:foo or tag:bar)');
			assert.equal(tree.joinMode, 'all');
			assert.lengthOf(tree.children, 2);
			assert.equal(tree.children[0].condition, 'creator');
			assert.equal(tree.children[1].joinMode, 'any');
			assert.deepEqual(tree.children[1].children, [
				{ condition: 'tag', operator: 'is', value: 'foo' },
				{ condition: 'tag', operator: 'is', value: 'bar' }
			]);
		});

		it("should bind 'and' tighter than 'or'", function () {
			let { tree } = Zotero.SearchQuery.parse("by:smith or by:jones and tag:foo");
			assert.equal(tree.joinMode, 'any');
			assert.lengthOf(tree.children, 2);
			assert.equal(tree.children[0].value, 'smith');
			assert.equal(tree.children[1].joinMode, 'all');
			assert.deepEqual(tree.children[1].children.map(c => c.value), ['jones', 'foo']);
		});

		it("should find what 'a or b and c' means", async function () {
			let smith = await createDataObject('item');
			smith.setCreators([{ firstName: "A", lastName: "Smith", creatorType: "author" }]);
			await smith.saveTx();
			let jonesTagged = await createDataObject('item');
			jonesTagged.setCreators([{ firstName: "B", lastName: "Jones", creatorType: "author" }]);
			jonesTagged.addTag("zzfoo");
			await jonesTagged.saveTx();
			// Jones without the tag is excluded, since `and` binds tighter
			let jonesOnly = await createDataObject('item');
			jonesOnly.setCreators([{ firstName: "C", lastName: "Jones", creatorType: "author" }]);
			await jonesOnly.saveTx();

			let search = Zotero.SearchQuery.getSearch("by:smith or by:jones and tag:zzfoo", {
				libraryID: Zotero.Libraries.userLibraryID
			});
			let ids = await search.search();
			assert.include(ids, smith.id);
			assert.include(ids, jonesTagged.id);
			assert.notInclude(ids, jonesOnly.id);
		});

		it("should treat adjacency as 'and' for precedence", function () {
			let tree = Zotero.SearchQuery.parse("by:smith tag:a or tag:b").tree;
			assert.equal(tree.joinMode, 'any');
			assert.equal(tree.children[0].joinMode, 'all');
			assert.deepEqual(tree.children[0].children.map(c => c.value), ['smith', 'a']);
			assert.equal(tree.children[1].value, 'b');

			tree = Zotero.SearchQuery.parse("by:smith or by:jones tag:foo").tree;
			assert.equal(tree.joinMode, 'any');
			assert.equal(tree.children[0].value, 'smith');
			assert.deepEqual(tree.children[1].children.map(c => c.value), ['jones', 'foo']);
		});

		it("should keep parentheses that aren't grouping clauses", function () {
			let { tree, text } = Zotero.SearchQuery.parse("by:smith The (Dis)United States");
			assert.lengthOf(tree.children, 1);
			assert.equal(text, "The (Dis)United States");
		});
	});

	describe("repeated values after 'or'", function () {
		it("should repeat the preceding field for a bare value", function () {
			let { tree } = Zotero.SearchQuery.parse('creator is "smith" and (tag is foo or bar)');
			assert.deepEqual(tree.children[1].children, [
				{ condition: 'tag', operator: 'is', value: 'foo' },
				{ condition: 'tag', operator: 'is', value: 'bar' }
			]);
		});

		it("should read a repeated value the same way as the first", function () {
			assert.deepEqual(clauses('type:book or "journal article"').map(c => c.value),
				['book', 'journalArticle']);
			assert.deepEqual(clauses("annotation color:red or blue").map(c => c.value),
				['#ff6666', '#2ea8e5']);
			// A value the condition doesn't accept isn't a clause at all
			let { tree, text } = Zotero.SearchQuery.parse("type:book or widget");
			assert.lengthOf(tree.children, 1);
			assert.equal(tree.children[0].value, 'book');
			// The join word itself isn't text to search for
			assert.equal(text, "widget");
		});

		it("should repeat the operator along with the field", function () {
			assert.deepEqual(clauses("added in the last 2 days or 3 days"), [
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '2 days' },
				{ condition: 'dateAdded', operator: 'isInTheLast', value: '3 days' }
			]);
			assert.equal(
				Zotero.SearchQuery.parse("added in the last 2 days or 3 days").text, ""
			);
		});

		it("should repeat only the clause the 'or' follows", function () {
			let { tree, text } = Zotero.SearchQuery.parse("by:smith research or development");
			assert.deepEqual(tree.children, [
				{ condition: 'creator', operator: 'contains', value: 'smith' }
			]);
			assert.equal(text, "research development");
		});

		it("should not repeat the preceding field after 'and'", function () {
			let { tree, text } = Zotero.SearchQuery.parse("by:smith and crispr");
			assert.deepEqual(tree.children, [
				{ condition: 'creator', operator: 'contains', value: 'smith' }
			]);
			assert.equal(text, "crispr");
		});

		it("should not repeat a field into something written as a clause", function () {
			let { tree, text } = Zotero.SearchQuery.parse("tag:foo or type:widget");
			assert.deepEqual(tree.children, [
				{ condition: 'tag', operator: 'is', value: 'foo' }
			]);
			assert.equal(text, "type:widget");
		});
	});

	describe("quoting", function () {
		it("should keep quoted values together", function () {
			assert.deepEqual(clauses('tag:"to read"'), [
				{ condition: 'tag', operator: 'is', value: 'to read' }
			]);
		});

		it("should accept curly quotes and a spaced colon", function () {
			assert.deepEqual(clauses("by:“Mary Ann Test”"), [
				{ condition: 'creator', operator: 'contains', value: 'Mary Ann Test' }
			]);
			assert.deepEqual(clauses("tag : foo"), [
				{ condition: 'tag', operator: 'is', value: 'foo' }
			]);
		});

		it("should read an unterminated quote as text", function () {
			let { tree, text } = Zotero.SearchQuery.parse('by:"Mary Ann');
			assert.isNull(tree);
			assert.equal(text, 'by:"Mary Ann');
		});

		it("should format a value so it reads back as one value", function () {
			for (let value of ['to read', '"Death is different"', 'it\'s "fine" (really)']) {
				let query = 'tag:' + Zotero.SearchQuery.formatValue(value);
				assert.deepEqual(clauses(query), [
					{ condition: 'tag', operator: 'is', value }
				], query);
			}
		});
	});

	describe("invalid input", function () {
		it("should ignore an unknown field name", function () {
			let { tree, text } = Zotero.SearchQuery.parse("colour:blue");
			assert.isNull(tree);
			assert.equal(text, "colour:blue");
		});

		it("should ignore an operator the field doesn't take", function () {
			let { tree, text } = Zotero.SearchQuery.parse("type before book");
			assert.isNull(tree);
			assert.include(text, "type");
		});

		it("should read an unusable clause as text", function () {
			for (let query of ["annotation color:chartreuse", 'title:""', "tag: ("]) {
				let { tree } = Zotero.SearchQuery.parse(query);
				assert.isNull(tree, query);
			}
		});

		it("should reject a value a condition's own filter rejects", function () {
			for (let query of ["number of tags > five", "number of tags:foo"]) {
				assert.isNull(Zotero.SearchQuery.parse(query).tree, query);
			}
			assert.deepEqual(clauses("number of tags > 5"), [
				{ condition: 'numTags', operator: 'isGreaterThan', value: '5' }
			]);
		});
	});

	describe("values shown in the interface", function () {
		it("should accept an item type by its displayed name", function () {
			for (let query of ["type:\"journal article\"", "type is journal article"]) {
				assert.equal(clauses(query)[0].value, 'journalArticle', query);
			}
			assert.equal(clauses("type is Book Section")[0].value, 'bookSection');
			// The stored name is Zotero's, not something to type
			assert.isEmpty(clauses("type:journalArticle"));
		});

		it("should accept an annotation color by name", function () {
			assert.deepEqual(clauses("annotation color:yellow"), [
				{
					condition: 'annotationColor',
					operator: 'is',
					value: '#ffd400',
					level: 'annotation'
				}
			]);
			// The stored hex is Zotero's, not something to type
			assert.isEmpty(clauses("annotation color:#5fb236"));
		});

		it("should accept 'color' for annotation color", function () {
			let { tree } = Zotero.SearchQuery.parse("type is annotation and color is red");
			assert.deepEqual(tree.children[1], {
				condition: 'annotationColor',
				operator: 'is',
				value: '#ff6666',
				level: 'annotation'
			});
			assert.deepEqual(clauses("color:yellow"), [
				{
					condition: 'annotationColor',
					operator: 'is',
					value: '#ffd400',
					level: 'annotation'
				}
			]);
		});

		it("should store an annotation type as its id", function () {
			assert.deepEqual(clauses("annotation type:highlight"), [
				{
					condition: 'annotationType',
					operator: 'is',
					value: String(Zotero.Annotations.ANNOTATION_TYPE_HIGHLIGHT),
					level: 'annotation'
				}
			]);
		});

		it("should accept storage types, including web links", function () {
			assert.deepEqual(clauses('attachment storage type:"Web Link"').map(c => c.value),
				['webLink']);
			assert.deepEqual(clauses('attachment storage type:"Linked File"').map(c => c.value),
				['linkedFile']);
		});

		it("should read an unknown value as text", function () {
			let { tree, text } = Zotero.SearchQuery.parse("type:widget");
			assert.isNull(tree);
			assert.equal(text, "type:widget");
		});
	});

	describe("name conditions", function () {
		it("should match within a name for 'is', which compares the full name", function () {
			assert.deepEqual(clauses("creator is okonkwo"), [
				{ condition: 'creator', operator: 'contains', value: 'okonkwo' }
			]);
			assert.deepEqual(clauses("author is not okonkwo"), [
				{ condition: 'author', operator: 'doesNotContain', value: 'okonkwo' }
			]);
		});

		it("should find an item by a creator's last name", async function () {
			let item = await createDataObject('item');
			item.setCreators([
				{ firstName: "Adaeze", lastName: "Okonkwo", creatorType: "author" }
			]);
			await item.saveTx();

			for (let query of ["creator is okonkwo", "by:okonkwo", "creator is Adaeze"]) {
				let search = Zotero.SearchQuery.getSearch(query, {
					libraryID: Zotero.Libraries.userLibraryID
				});
				assert.include(await search.search(), item.id, query);
			}
		});
	});

	describe("multi-word names", function () {
		it("should parse a field name of several words", function () {
			assert.deepEqual(clauses("annotation comment:unclear"), [
				{
					condition: 'annotationComment',
					operator: 'contains',
					value: 'unclear',
					level: 'annotation'
				}
			]);
		});

		it("should accept a condition by the name shown in the interface", function () {
			let localized = Zotero.SearchConditions.getLocalizedName('publicationTitle');
			assert.deepEqual(clauses(localized + ":Nature"), [
				{ condition: 'publicationTitle', operator: 'contains', value: 'Nature' }
			]);
			// The stored name is Zotero's, not something to type
			assert.isFalse(Zotero.SearchQuery.getField('publicationTitle'));
		});

		it("should scope a child-item field to its level", function () {
			assert.deepEqual(clauses("attachment tag:important"), [
				{ condition: 'tag', operator: 'is', value: 'important', level: 'attachment' }
			]);
			// A condition with a level of its own is scoped to it as well
			assert.deepEqual(clauses("annotation text:important"), [
				{
					condition: 'annotationText',
					operator: 'contains',
					value: 'important',
					level: 'annotation'
				}
			]);
			// Bare `annotation` could mean the text or the comment, so it's
			// neither
			assert.isNull(Zotero.SearchQuery.parse("annotation:important").tree);
		});
	});

	describe("'has' and 'no' shorthand", function () {
		it("should read 'has <condition>' and 'no <condition>' as non-empty and empty conditions", function () {
			assert.deepEqual(clauses('type is "journal article" and no doi'), [
				{ condition: 'itemType', operator: 'is', value: 'journalArticle' },
				{ condition: 'DOI', operator: 'isEmpty', value: '' }
			]);
			assert.deepEqual(clauses("has doi"), [
				{ condition: 'DOI', operator: 'isNotEmpty', value: '' }
			]);
			// A word that isn't a condition keeps the `no` as text
			let { tree, text } = Zotero.SearchQuery.parse("no dice");
			assert.isNull(tree);
			assert.equal(text, "no dice");
			// Before a clause of its own, the `no` is text as well
			({ tree, text } = Zotero.SearchQuery.parse("no title:foo"));
			assert.deepEqual(tree.children, [
				{ condition: 'title', operator: 'contains', value: 'foo' }
			]);
			assert.equal(text, "no");
		});

		it("should compare counts for a count-backed target", async function () {
			assert.deepEqual(clauses("no annotation"), [
				{ condition: 'numAnnotations', operator: 'is', value: '0' }
			]);
			assert.deepEqual(clauses("no tag"), [
				{ condition: 'numTags', operator: 'is', value: '0' }
			]);
			assert.deepEqual(clauses("has attachment"), [
				{ condition: 'numAttachments', operator: 'isGreaterThan', value: '0' }
			]);

			// An image annotation with no text is still an annotation
			let item = await createDataObject('item');
			let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
			await createAnnotation('image', attachment);
			let bare = await createDataObject('item');

			let ids = await Zotero.SearchQuery.getSearch("has annotation", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.include(ids, item.id);
			assert.notInclude(ids, bare.id);

			ids = await Zotero.SearchQuery.getSearch("no annotation", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.include(ids, bare.id);
			assert.notInclude(ids, item.id);
		});

		it("should read the plural forms as counts", function () {
			assert.deepEqual(clauses("no tags"), [
				{ condition: 'numTags', operator: 'is', value: '0' }
			]);
			assert.deepEqual(clauses("has attachments"), [
				{ condition: 'numAttachments', operator: 'isGreaterThan', value: '0' }
			]);
		});

		it("should keep 'no' on a child-scoped field as text", function () {
			let { tree, text } = Zotero.SearchQuery.parse("no attachment title");
			assert.isNull(tree);
			assert.equal(text, "no attachment title");
			// `has` on one means a child with the field filled in
			assert.deepEqual(clauses("has attachment title"), [
				{ condition: 'title', operator: 'isNotEmpty', value: '', level: 'attachment' }
			]);
		});

		it("should read 'no' after 'or' as a condition, not a repeated value", function () {
			let { tree, text } = Zotero.SearchQuery.parse("tag:foo or no doi");
			assert.equal(tree.joinMode, 'any');
			assert.deepEqual(tree.children, [
				{ condition: 'tag', operator: 'is', value: 'foo' },
				{ condition: 'DOI', operator: 'isEmpty', value: '' }
			]);
			assert.equal(text, "");
		});
	});

	describe("#getSearch()", function () {
		it("should return false for a query with no clauses", function () {
			assert.isFalse(Zotero.SearchQuery.getSearch("crispr screens"));
		});

		it("should match free text the way the mode does", function () {
			// A quicksearch condition expands into the fields it covers
			let conditions = mode => Object.values(
				Zotero.SearchQuery.getSearch("by:smith crispr", { mode }).getConditions()
			).map(condition => condition.condition);
			assert.notInclude(conditions('fields'), 'fulltextContent');
			assert.include(conditions('fields'), 'tag');
			assert.include(conditions('everything'), 'fulltextContent');
			// Best Match with no index falls back to matching text
			assert.notInclude(conditions('bestMatch'), 'bestMatch');
		});

		it("should find items matching both the clauses and the text", async function () {
			let match = await createDataObject('item', { title: "Glucose monitoring in the wild" });
			match.setCreators([{ firstName: "Ada", lastName: "Nakamura", creatorType: "author" }]);
			await match.saveTx();
			let wrongText = await createDataObject('item', { title: "Something else entirely" });
			wrongText.setCreators([{ firstName: "Ada", lastName: "Nakamura", creatorType: "author" }]);
			await wrongText.saveTx();

			let search = Zotero.SearchQuery.getSearch("by:nakamura glucose", {
				libraryID: Zotero.Libraries.userLibraryID,
				mode: 'fields'
			});
			let ids = await search.search();
			assert.include(ids, match.id);
			assert.notInclude(ids, wrongText.id);
		});

		it("should keep an 'any' query separate from the free text", async function () {
			let tagged = await createDataObject('item', { title: "Glucose sensing" });
			tagged.addTag("wearables");
			await tagged.saveTx();
			let otherTag = await createDataObject('item', { title: "Glucose sensing" });
			otherTag.addTag("clinical");
			await otherTag.saveTx();
			let noMatch = await createDataObject('item', { title: "Unrelated" });
			noMatch.addTag("wearables");
			await noMatch.saveTx();

			let search = Zotero.SearchQuery.getSearch("(tag:wearables or tag:clinical) glucose", {
				libraryID: Zotero.Libraries.userLibraryID,
				mode: 'fields'
			});
			let ids = await search.search();
			assert.include(ids, tagged.id);
			assert.include(ids, otherTag.id);
			assert.notInclude(ids, noMatch.id);
		});

		it("should match items by conditions on their children", async function () {
			// The tag lives on the attachment, the type on the item
			let book = await createDataObject('item', { itemType: 'book' });
			let attachment = await importFileAttachment('test.pdf', { parentItemID: book.id });
			attachment.addTag('zzchildtag');
			await attachment.saveTx();
			let untagged = await createDataObject('item', { itemType: 'book' });

			let ids = await Zotero.SearchQuery.getSearch("type:book tag:zzchildtag", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.include(ids, book.id);
			assert.notInclude(ids, untagged.id);
			assert.notInclude(ids, attachment.id);

			// Attachment content alongside an item-level condition
			let article = await createDataObject('item', { itemType: 'journalArticle' });
			await importFileAttachment('search/foobar.html', { parentItemID: article.id });
			ids = await Zotero.SearchQuery.getSearch(
				'type:"journal article" attachment content:"foo bar"',
				{ libraryID: Zotero.Libraries.userLibraryID }
			).search();
			assert.include(ids, article.id);
			assert.notInclude(ids, book.id);
		});

		it("should scope a condition that matches at a child level", async function () {
			let item = await createDataObject('item');
			item.setCreators([{ firstName: "Ada", lastName: "Ferrer", creatorType: "author" }]);
			await item.saveTx();
			let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
			let annotation = await createAnnotation('highlight', attachment);
			annotation.annotationText = 'zzmarker';
			await annotation.saveTx();

			let search = Zotero.SearchQuery.getSearch("by:ferrer annotation text:zzmarker", {
				libraryID: Zotero.Libraries.userLibraryID
			});
			assert.sameMembers(await search.search(), [item.id]);
		});

		it("should return child rows for a child item type", async function () {
			let item = await createDataObject('item');
			item.setCreators([{ firstName: 'Ada', lastName: 'Zzpin', creatorType: 'author' }]);
			await item.saveTx();
			let attachment = await importFileAttachment('test.pdf', { parentItemID: item.id });
			let other = await createDataObject('item');
			let otherAttachment = await importFileAttachment('test.pdf', { parentItemID: other.id });

			// The type names the rows to return; other conditions map to them
			let ids = await Zotero.SearchQuery.getSearch("type:attachment by:zzpin", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.sameMembers(ids, [attachment.id]);

			// Alone, every attachment
			ids = await Zotero.SearchQuery.getSearch("type:attachment", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.include(ids, attachment.id);
			assert.include(ids, otherAttachment.id);
			assert.notInclude(ids, item.id);

			// Annotations are rows too
			let annotation = await createAnnotation('highlight', attachment);
			ids = await Zotero.SearchQuery.getSearch("type:annotation by:zzpin", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.sameMembers(ids, [annotation.id]);

			// Negated, it's an ordinary condition on items
			ids = await Zotero.SearchQuery.getSearch("type is not attachment", {
				libraryID: Zotero.Libraries.userLibraryID
			}).search();
			assert.include(ids, item.id);
			assert.notInclude(ids, attachment.id);
		});
	});

	describe("#addToSearch()", function () {
		it("should build a search that matches the right items", async function () {
			let match = await createDataObject('item', {
				itemType: 'book',
				title: "Grounded theory and its discontents"
			});
			match.setCreators([{ firstName: "Alice", lastName: "Smith", creatorType: "author" }]);
			match.addTag("methodology");
			await match.saveTx();

			let wrongCreator = await createDataObject('item', { itemType: 'book' });
			wrongCreator.addTag("methodology");
			await wrongCreator.saveTx();

			let wrongTag = await createDataObject('item', { itemType: 'book' });
			wrongTag.setCreators([{ firstName: "Alice", lastName: "Smith", creatorType: "author" }]);
			await wrongTag.saveTx();

			let { tree } = Zotero.SearchQuery.parse('by:smith and (tag:methodology or tag:missing)');
			let search = new Zotero.Search();
			search.libraryID = Zotero.Libraries.userLibraryID;
			Zotero.SearchQuery.addToSearch(search, tree);
			let ids = await search.search();

			assert.include(ids, match.id);
			assert.notInclude(ids, wrongCreator.id);
			assert.notInclude(ids, wrongTag.id);
		});
	});

	describe("#tokenize()", function () {
		it("should cover every character of the input", function () {
			let query = 'by:smith and (tag:"to read" or bar) crispr';
			let tokens = Zotero.SearchQuery.tokenize(query);
			assert.equal(tokens[0].start, 0);
			assert.equal(tokens[tokens.length - 1].end, query.length);
			for (let i = 1; i < tokens.length; i++) {
				assert.equal(tokens[i].start, tokens[i - 1].end);
			}
		});

		it("should recognize a condition before its value is typed", function () {
			let types = Zotero.SearchQuery.tokenize("tag:")
				.map(token => token.type);
			assert.deepEqual(types, ['field', 'operator']);

			// Nothing to match on yet, and not text to search for
			let { tree, text } = Zotero.SearchQuery.parse("crispr tag:");
			assert.isNull(tree);
			assert.equal(text, "crispr");
			assert.isFalse(Zotero.SearchQuery.getSearch("tag:"));
		});

		it("should label field, operator, and value tokens for highlighting", function () {
			let types = Zotero.SearchQuery.tokenize("by:smith crispr")
				.filter(token => token.type !== 'space')
				.map(token => token.type);
			assert.deepEqual(types, ['field', 'operator', 'value', 'text']);
		});
	});

	describe("multiple libraries", function () {
		it("should match in whatever library the results come from", async function () {
			let group = await createGroup();
			let groupItem = await createDataObject('item',
				{ libraryID: group.libraryID, tags: [{ tag: 'zzlib' }] });

			let query = Zotero.SearchQuery.getSearch('tag:zzlib');
			assert.isNull(query.libraryID);

			// Scoped to a row the way CollectionTreeRow scopes a filter search
			let scope = new Zotero.Search();
			scope.libraryID = group.libraryID;
			scope.addCondition('noChildren', 'true');
			let scoped = new Zotero.Search();
			scoped.fromJSON(query.toJSON());
			scoped.setScope(scope, true);
			assert.sameMembers(await scoped.search(), [groupItem.id]);
		});
	});

	describe("#getCompletions()", function () {
		let labels = (query, caret) => (Zotero.SearchQuery.getCompletions(query, caret)
			|| { completions: [] }).completions.map(c => c.label);

		it("should complete a condition name partway through a word", function () {
			let completions = Zotero.SearchQuery.getCompletions("ta");
			assert.equal(completions.type, 'field');
			assert.equal(completions.start, 0);
			assert.equal(completions.end, 2);
			assert.include(completions.completions.map(c => c.label), "tag:");
			// One row per condition, by its shortest name
			assert.notInclude(completions.completions.map(c => c.label), "tag name:");
		});

		it("should complete a condition name of several words", function () {
			let completions = Zotero.SearchQuery.getCompletions("annotation ty");
			assert.deepEqual(completions.completions.map(c => c.label), ["annotation type:"]);
			assert.equal(completions.start, 0);

			// The words before it are still text
			completions = Zotero.SearchQuery.getCompletions("crispr annotation ty");
			assert.deepEqual(completions.completions.map(c => c.label), ["annotation type:"]);
			assert.equal(completions.start, "crispr ".length);
		});

		it("should complete a condition name after other text", function () {
			let completions = Zotero.SearchQuery.getCompletions("crispr ta");
			assert.equal(completions.start, 7);
			assert.include(completions.completions.map(c => c.label), "tag:");
		});

		it("should complete the values a condition takes", function () {
			assert.include(labels("type:"), "journal article");
			assert.include(labels("type:jour"), "journal article");
			// Inserted so that the parser reads it back
			let completions = Zotero.SearchQuery.getCompletions("type:jour");
			let article = completions.completions.find(c => c.label === "journal article");
			assert.equal(article.text, '"journal article"');
			assert.equal(completions.start, "type:".length);

			assert.include(labels("annotation color:"), "yellow");
			// A color value carries its color, for the swatch in the list
			let yellow = Zotero.SearchQuery.getCompletions("color:").completions
				.find(c => c.label === "yellow");
			assert.equal(yellow.color, '#ffd400');
		});

		it("should replace an opening quote along with the value being completed", function () {
			let head = 'type:"jour';
			let completions = Zotero.SearchQuery.getCompletions(head);
			let article = completions.completions.find(c => c.label === "journal article");
			let result = head.slice(0, completions.start) + article.text;
			assert.equal(result, 'type:"journal article"');
			assert.equal(clauses(result)[0].value, 'journalArticle');
		});

		it("should defer to a lookup for values that come from the library", function () {
			let completions = Zotero.SearchQuery.getCompletions("tag:zz");
			assert.equal(completions.lookup.fieldName, 'tag');
			assert.equal(completions.prefix, 'zz');
			assert.equal(completions.start, "tag:".length);
			assert.isEmpty(completions.completions);

			// Creator conditions search both single- and two-field names
			completions = Zotero.SearchQuery.getCompletions("by:smi");
			assert.equal(completions.lookup.fieldName, 'creator');
			assert.equal(completions.lookup.fieldMode, 2);

			// The word form of an operator reads the same as the colon
			completions = Zotero.SearchQuery.getCompletions("creator is a");
			assert.equal(completions.lookup.fieldName, 'creator');
			assert.equal(completions.prefix, 'a');
			assert.equal(completions.start, "creator is ".length);
			completions = Zotero.SearchQuery.getCompletions("creator is not a");
			assert.equal(completions.prefix, 'a');
			// The last condition in the query is the one being typed
			completions = Zotero.SearchQuery.getCompletions("tag is x creator is a");
			assert.equal(completions.lookup.fieldName, 'creator');
			assert.equal(completions.prefix, 'a');
			assert.include(labels("item type is boo"), "book");

			// Nothing typed yet, so there's nothing to narrow the library to
			assert.isNull(Zotero.SearchQuery.getCompletions("tag:"));
			assert.isNull(Zotero.SearchQuery.getCompletions("by:"));
			// A condition with a fixed set of values still offers all of them
			assert.include(labels("type:"), "journal article");
		});

		it("should complete a value repeated with 'or'", function () {
			let completions = Zotero.SearchQuery.getCompletions("type:book or jour");
			assert.include(completions.completions.map(c => c.label), "journal article");
			assert.equal(completions.start, "type:book or ".length);
			// A library lookup, as for the first value
			completions = Zotero.SearchQuery.getCompletions("tag:foo or zz");
			assert.equal(completions.lookup.fieldName, 'tag');
			assert.equal(completions.prefix, 'zz');
		});

		it("should complete a condition after 'has' or 'no' without a colon", function () {
			let head = "type:book and no d";
			let completions = Zotero.SearchQuery.getCompletions(head);
			let doi = completions.completions.find(c => c.label === 'doi');
			assert.isDefined(doi);
			let result = head.slice(0, completions.start) + doi.text;
			assert.deepEqual(clauses(result)[1],
				{ condition: 'DOI', operator: 'isEmpty', value: '' });
			// Only conditions that can be empty are offered
			let names = labels("no t");
			assert.include(names, 'title');
			assert.notInclude(names, 'type');
			assert.notInclude(names, 'type:');
			assert.include(labels("has d"), 'doi');
			// Count-backed targets complete by their bare names, even ones
			// that aren't conditions on their own
			assert.include(labels("no att"), 'attachment');
			// The plural forms work but complete by the shortest name
			let tagNames = labels("no ta");
			assert.include(tagNames, 'tag');
			assert.notInclude(tagNames, 'tags');
		});

		it("should have nothing to offer for free text", function () {
			assert.isNull(Zotero.SearchQuery.getCompletions("crispr "));
			// Partway through a word, where a completion would leave a tail
			assert.isNull(Zotero.SearchQuery.getCompletions("tag:foo", 2));
		});

		it("should offer nothing inside an unfinished quote", function () {
			assert.isNull(Zotero.SearchQuery.getCompletions('"annotation t'));
			assert.isNull(Zotero.SearchQuery.getCompletions('title:"annotation t'));
		});

		it("should not read a possible operator as a new field", function () {
			assert.isNull(Zotero.SearchQuery.getCompletions("year is b"));
			assert.isNull(Zotero.SearchQuery.getCompletions("title does not c"));
		});

		it("should offer nothing after an operator the condition doesn't take", function () {
			// The word at the value position gets neither the values the
			// operator can't apply to nor a new-field suggestion
			assert.isNull(Zotero.SearchQuery.getCompletions("type before boo"));
			assert.isNull(Zotero.SearchQuery.getCompletions("type is before boo"));
			assert.isNull(Zotero.SearchQuery.getCompletions("annotation color greater than y"));
		});

		it("should not offer a field for the value being typed", function () {
			assert.isNull(Zotero.SearchQuery.getCompletions("title is ta"));
			assert.isNull(Zotero.SearchQuery.getCompletions("title contains ta"));
			assert.isNull(Zotero.SearchQuery.getCompletions("title is before"));
			// A word after a complete clause can still start one
			let completions = Zotero.SearchQuery.getCompletions("title is grounded ta");
			assert.include(completions.completions.map(c => c.label), "tag:");
		});
	});
});
