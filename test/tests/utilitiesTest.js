describe("Zotero.Utilities", function() {
	describe("cleanAuthor", function() {
		it('should parse author names', function() {
			for(let useComma of [false, true]) {
				for(let first_expected of [["First", "First"],
				                           ["First Middle", "First Middle"],
				                           ["F. R. S.", "F. R. S."],
				                           ["F.R.S.", "F. R. S."],
				                           ["F R S", "F. R. S."],
				                           ["FRS", "F. R. S."]]) {
					let [first, expected] = first_expected;
					let str = useComma ? "Last, "+first : first+" Last";
					let author = Zotero.Utilities.cleanAuthor(str, "author", useComma);
					assert.equal(author.firstName, expected);
					assert.equal(author.lastName, "Last");
				}
			}
		});
		
		it('should not parse words starting with symbols as last name', function() {
			let author = Zotero.Utilities.cleanAuthor('First Middle Last [CountryName]', false);
			assert.equal(author.firstName, 'First Middle');
			// Brackets at the beginning and end of a string get removed for strings
			// such as [First Last] -> Last, First.
			// The current output is not ideal, but better than "[CountryName, First Middle Last"
			assert.equal(author.lastName, 'Last [CountryName');
		});
		
		it('should parse names starting with unicode characters correctly', function() {
			let author = Zotero.Utilities.cleanAuthor('Ąžuolas Žolynas', false);
			assert.equal(author.firstName, 'Ąžuolas');
			assert.equal(author.lastName, 'Žolynas');
		})
	});
	
	
	describe("#cleanDOI()", function () {
		var cleanDOI = Zotero.Utilities.cleanDOI;
		var doi = '10.1088/1748-9326/11/4/048002';
		var shortDOI = '10/aabbe';
		
		it("should parse a DOI", function () {
			assert.equal(cleanDOI(`${doi}`), doi);
		});
		
		it("should parse a short DOI", function () {
			assert.equal(cleanDOI(`${shortDOI}`), shortDOI);
		});
		
		it("should parse a DOI at the end of a sentence", function () {
			assert.equal(cleanDOI(`Foo bar ${doi}. Foo bar`), doi);
		});
		
		// FIXME
		it.skip("should parse a DOI in parentheses", function () {
			assert.equal(cleanDOI(`Foo bar (${doi}) foo bar`), doi);
		});
		
		// FIXME
		it.skip("should parse a DOI in brackets", function () {
			assert.equal(cleanDOI(`Foo bar [${doi}] foo bar`), doi);
		});
	});
	
	
	describe("#cleanISBN()", function() {
		let cleanISBN = Zotero.Utilities.cleanISBN;
		it("should return false for non-ISBN string", function() {
			assert.isFalse(cleanISBN(''), 'returned false for empty string');
			assert.isFalse(cleanISBN('Random String 123'), 'returned false for non-ISBN string');
			assert.isFalse(cleanISBN('1234X67890'), 'returned false for ISBN10-looking string with X in the middle');
			assert.isFalse(cleanISBN('987123456789X'), 'returned false for ISBN13-looking string with X as check-digit');
		});
		it("should return false for invalid ISBN string", function() {
			assert.isFalse(cleanISBN('1234567890'), 'returned false for invalid ISBN10');
			assert.isFalse(cleanISBN('9871234567890'), 'returned false for invalid ISBN13');
		});
		it("should return valid ISBN string given clean, valid ISBN string", function() {
			assert.equal(cleanISBN('123456789X'), '123456789X', 'passed through valid ISBN10');
			assert.equal(cleanISBN('123456789x'), '123456789X', 'passed through valid ISBN10 with lower case input');
			assert.equal(cleanISBN('9781234567897'), '9781234567897', 'passed through valid ISBN13');
			assert.equal(cleanISBN('9791843123391'), '9791843123391', 'passed through valid ISBN13 in 979 range');
		});
		it("should strip off internal characters in ISBN string", function() {
			let ignoredChars = '\x2D\xAD\u2010\u2011\u2012\u2013\u2014\u2015\u2043\u2212' // Dashes
				+ ' \xA0\r\n\t\x0B\x0C\u1680\u2000\u2001\u2002\u2003\u2004\u2005' // Spaces
				+ '\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';
			for (let i=0; i<ignoredChars.length; i++) {
				let charCode = '\\u' + Zotero.Utilities.lpad(ignoredChars.charCodeAt(i).toString(16).toUpperCase(), '0', 4);
				assert.equal(cleanISBN('9781' + ignoredChars.charAt(i) + '234567897'), '9781234567897', 'stripped off ' + charCode);
			}
			assert.equal(cleanISBN('9781' + ignoredChars + '234567897'), '9781234567897', 'stripped off all ignored characters');
			
			let isbnChars = ignoredChars + '1234567890';
			for (let i=1; i<1327; i++) { // More common characters through Cyrillic letters
				let c = String.fromCharCode(i);
				if (isbnChars.indexOf(c) != -1) continue;
				
				let charCode = '\\u' + Zotero.Utilities.lpad(i.toString(16).toUpperCase(), '0', 4);
				assert.isFalse(cleanISBN('9781' + c + '234567897'), 'did not ignore internal character ' + charCode);
			}
		});
		it("should strip off surrounding non-ISBN string", function() {
			assert.equal(cleanISBN('ISBN 9781234567897'), '9781234567897', 'stripped off preceding string (with space)');
			assert.equal(cleanISBN('ISBN:9781234567897'), '9781234567897', 'stripped off preceding string (without space)');
			assert.equal(cleanISBN('9781234567897 ISBN13'), '9781234567897', 'stripped off trailing string (with space)');
			assert.equal(cleanISBN('9781234567897(ISBN13)'), '9781234567897', 'stripped off trailing string (without space)');
			assert.equal(cleanISBN('ISBN13:9781234567897 (print)'), '9781234567897', 'stripped off surrounding string');
			assert.equal(cleanISBN('978 9781234567 897'), '9781234567897', 'stripped off pseudo-ISBN prefix');
		});
		it("should return the first valid ISBN from a string with multiple ISBNs", function() {
			assert.equal(cleanISBN('9781234567897, 9791843123391'), '9781234567897', 'returned first valid ISBN13 from list of valid ISBN13s');
			assert.equal(cleanISBN('123456789X, 0199535922'), '123456789X', 'returned first valid ISBN13 from list of valid ISBN13s');
			assert.equal(cleanISBN('123456789X 9781234567897'), '123456789X', 'returned first valid ISBN (10) from a list of mixed-length ISBNs');
			assert.equal(cleanISBN('9781234567897 123456789X'), '9781234567897', 'returned first valid ISBN (13) from a list of mixed-length ISBNs');
			assert.equal(cleanISBN('1234567890 9781234567897'), '9781234567897', 'returned first valid ISBN in the list with valid and invalid ISBNs');
		});
		it("should not return an ISBN from a middle of a longer number string", function() {
			assert.isFalse(cleanISBN('1239781234567897'), 'did not ignore number prefix');
			assert.isFalse(cleanISBN('9781234567897123'), 'did not ignore number suffix');
			assert.isFalse(cleanISBN('1239781234567897123'), 'did not ignore surrounding numbers');
		});
		it("should return valid ISBN from a dirty string", function() {
			assert.equal(cleanISBN('<b>ISBN</b>:978-1 234\xA056789 - 7(print)\n<b>ISBN-10</b>:123\x2D456789X (print)'), '9781234567897');
		});
		it("should not validate check digit when dontValidate is set", function() {
			assert.equal(cleanISBN('9781234567890', true), '9781234567890', 'plain ISBN13 with wrong check digit');
			assert.equal(cleanISBN('1234567890', true), '1234567890', 'plain ISBN10 with wrong check digit');
			assert.equal(cleanISBN('1234567890 9781234567897', true), '1234567890', 'returned first ISBN10 (invalid) in the list with valid and invalid ISBNs');
			assert.equal(cleanISBN('9781234567890 123456789X', true), '9781234567890', 'returned first ISBN13 (invalid) in the list with valid and invalid ISBNs');
		});
		it("should not pass non-ISBN strings if dontValidate is set", function() {
			assert.isFalse(cleanISBN('', true), 'returned false for empty string');
			assert.isFalse(cleanISBN('Random String 123', true), 'returned false for non-ISBN string');
			assert.isFalse(cleanISBN('1234X67890', true), 'returned false for ISBN10-looking string with X in the middle');
			assert.isFalse(cleanISBN('123456789Y', true), 'returned false for ISBN10-looking string with Y as check digit');
			assert.isFalse(cleanISBN('987123456789X', true), 'returned false for ISBN13-looking string with X as check-digit');
			assert.isFalse(cleanISBN('1239781234567897', true), 'did not ignore number prefix');
			assert.isFalse(cleanISBN('9781234567897123', true), 'did not ignore number suffix');
			assert.isFalse(cleanISBN('1239781234567897123', true), 'did not ignore surrounding numbers');
		});
	});
	describe("toISBN13", function() {
		let toISBN13 = Zotero.Utilities.toISBN13;
		it("should throw on invalid ISBN", function() {
			let errorMsg = 'ISBN not found in "',
				invalidStrings = ['', 'random string', '1234567890123'];
			for (let i=0; i<invalidStrings.length; i++) {
				assert.throws(toISBN13.bind(null,invalidStrings[i]), errorMsg + invalidStrings[i] + '"');
			}
		});
		it("should convert to ISBN13", function() {
			assert.equal(toISBN13('123456789X'), '9781234567897', 'converts ISBN10 to ISBN13');
			assert.equal(toISBN13('9781234567897'), '9781234567897', 'ISBN13 stays the same');
			assert.equal(toISBN13('9791843123391'), '9791843123391', '979 ISBN13 stays the same');
			assert.equal(toISBN13('978-1234567897'), '9781234567897', 'accepts hyphenated ISBN');
		});
		it("should ignore invalid check digit", function() {
			assert.equal(toISBN13('1234567890'), '9781234567897', 'converts ISBN10 with invalid check digit to ISBN13');
			assert.equal(toISBN13('9781234567890'), '9781234567897', 'corrects invalid ISBN13 check digit');
		});
	});
	describe("cleanISSN", function() {
		let cleanISSN = Zotero.Utilities.cleanISSN;
		it("should return false for non-ISSN string", function() {
			assert.isFalse(cleanISSN(''), 'returned false for empty string');
			assert.isFalse(cleanISSN('Random String 123'), 'returned false for non-ISSN string');
			assert.isFalse(cleanISSN('123X-5679'), 'returned false for ISSN-looking string with X in the middle');
		});
		it("should return false for invalid ISSN string", function() {
			assert.isFalse(cleanISSN('12345678'), 'returned false for invalid ISSN');
			assert.isFalse(cleanISSN('1234-5678'), 'returned false for invalid ISSN with hyphen');
		});
		it("should return valid ISSN string given clean, valid ISSN string", function() {
			assert.equal(cleanISSN('1234-5679'), '1234-5679', 'passed through valid ISSN');
			assert.equal(cleanISSN('2090-424X'), '2090-424X', 'passed through valid ISSN with X check digit');
		});
		it("should hyphenate valid ISSN", function() {
			assert.equal(cleanISSN('12345679'), '1234-5679', 'hyphenated valid ISSN');
		});
		it("should strip off internal characters in ISSN string", function() {
			let ignoredChars = '\x2D\xAD\u2010\u2011\u2012\u2013\u2014\u2015\u2043\u2212' // Dashes
				+ ' \xA0\r\n\t\x0B\x0C\u1680\u2000\u2001\u2002\u2003\u2004\u2005' // Spaces
				+ '\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';
			for (let i=0; i<ignoredChars.length; i++) {
				let charCode = '\\u' + Zotero.Utilities.lpad(ignoredChars.charCodeAt(i).toString(16).toUpperCase(), '0', 4);
				assert.equal(cleanISSN('1' + ignoredChars.charAt(i) + '2345679'), '1234-5679', 'stripped off ' + charCode);
			}
			assert.equal(cleanISSN('1' + ignoredChars + '2345679'), '1234-5679', 'stripped off all ignored characters');
			
			let isbnChars = ignoredChars + '1234567890';
			for (let i=1; i<1327; i++) { // More common characters through Cyrillic letters
				let c = String.fromCharCode(i);
				if (isbnChars.indexOf(c) != -1) continue;
				
				let charCode = '\\u' + Zotero.Utilities.lpad(i.toString(16).toUpperCase(), '0', 4);
				assert.isFalse(cleanISSN('1' + c + '2345679'), 'did not ignore internal character ' + charCode);
			}
		});
		it("should strip off surrounding non-ISSN string", function() {
			assert.equal(cleanISSN('ISSN 1234-5679'), '1234-5679', 'stripped off preceding string (with space)');
			assert.equal(cleanISSN('ISSN:1234-5679'), '1234-5679', 'stripped off preceding string (without space)');
			assert.equal(cleanISSN('1234-5679 ISSN'), '1234-5679', 'stripped off trailing string (with space)');
			assert.equal(cleanISSN('1234-5679(ISSN)'), '1234-5679', 'stripped off trailing string (without space)');
			assert.equal(cleanISSN('ISSN:1234-5679 (print)'), '1234-5679', 'stripped off surrounding string');
			assert.equal(cleanISSN('123 12345 679'), '1234-5679', 'stripped off pseudo-ISSN prefix');
		});
		it("should return the first valid ISSN from a string with multiple ISSNs", function() {
			assert.equal(cleanISSN('1234-5679, 0028-0836'), '1234-5679', 'returned first valid ISSN from list of valid ISSNs');
			assert.equal(cleanISSN('1234-5678, 0028-0836'), '0028-0836', 'returned first valid ISSN in the list with valid and invalid ISSNs');
		});
		it("should not return an ISSN from a middle of a longer number string", function() {
			assert.isFalse(cleanISSN('12312345679'), 'did not ignore number prefix');
			assert.isFalse(cleanISSN('12345679123'), 'did not ignore number suffix');
			assert.isFalse(cleanISSN('12312345679123'), 'did not ignore surrounding numbers');
		});
		it("should return valid ISSN from a dirty string", function() {
			assert.equal(cleanISSN('<b>ISSN</b>:1234\xA0-\t5679(print)\n<b>eISSN (electronic)</b>:0028-0836'), '1234-5679');
		});
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
			assert.equal(cslJSONNote.type, 'article', 'note is exported as "article"');
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
			assert.equal(cslJSONAttachment.type, 'article', 'attachment is exported as "article"');
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
	
	describe("#parseURL()", function () {
		var f;
		before(() => {
			f = Zotero.Utilities.parseURL;
		});
		
		describe("#fileName", function () {
			it("should contain filename", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileName', 'def.html');
			});
			
			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileName', '');
			});
		});
		
		describe("#fileExtension", function () {
			it("should contain extension", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileExtension', 'html');
			});
			
			it("should be empty if no extension", function () {
				assert.propertyVal(f('http://example.com/abc/def'), 'fileExtension', '');
			});
			
			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileExtension', '');
			});
		});
		
		describe("#fileBaseName", function () {
			it("should contain base name", function () {
				assert.propertyVal(f('http://example.com/abc/def.html?foo=bar'), 'fileBaseName', 'def');
			});
			
			it("should equal filename if no extension", function () {
				assert.propertyVal(f('http://example.com/abc/def'), 'fileBaseName', 'def');
			});
			
			it("should be empty if no filename", function () {
				assert.propertyVal(f('http://example.com/abc/'), 'fileBaseName', '');
			});
		});
	});
	
	
	describe("#ellipsize()", function () {
		describe("with wordBoundary", function () {
			it("should truncate at word boundary", function* () {
				assert.equal(Zotero.Utilities.ellipsize("abc def ghi", 3, true), "abc…");
			});
			
			it("should trim whitespace after word boundary", function* () {
				assert.equal(Zotero.Utilities.ellipsize("abc def ghi", 4, true), "abc…");
			});
			
			it("should trim characters after word boundary", function () {
				assert.equal(Zotero.Utilities.ellipsize("abc def ghi", 5, true), "abc…");
			});
			
			it("should truncate in the middle of a word", function () {
				assert.equal(Zotero.Utilities.ellipsize("abcdefghi", 6, true), "abcdef…");
			});
			
			it("should truncate at word boundary with previous space within radius", function () {
				assert.equal(Zotero.Utilities.ellipsize("abc def ghi", 7, true), "abc def…");
			});
			
			it("should return string as is if shorter than length", function () {
				assert.equal(Zotero.Utilities.ellipsize("abcdefg", 8, true), "abcdefg");
			});
			
			it("should return string as is if equal to length", function () {
				assert.equal(Zotero.Utilities.ellipsize("abcdefgh", 8, true), "abcdefgh");
			});
		});
	});
});
