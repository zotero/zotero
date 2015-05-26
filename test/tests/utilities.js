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
	});
	describe("cleanISBN", function() {
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
				+ ' \xA0\r\n\t\x0B\x0C\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005' // Spaces
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
				+ ' \xA0\r\n\t\x0B\x0C\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005' // Spaces
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
		it("should accept Zotero.Item and Zotero export item format", function() {
			let data = populateDBWithSampleData(loadSampleData('journalArticle'));
			let item = Zotero.Items.get(data.journalArticle.id);
			
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
		});
		it("should convert standalone notes to expected format", function() {
			let note = new Zotero.Item('note');
			note.setNote('Some note longer than 50 characters, which will become the title.');
			note = Zotero.Items.get(note.save());
			
			let cslJSONNote = Zotero.Utilities.itemToCSLJSON(note);
			assert.equal(cslJSONNote.type, 'article', 'note is exported as "article"');
			assert.equal(cslJSONNote.title, note.getNoteTitle(), 'note title is set to Zotero pseudo-title');
		});
		it("should convert standalone attachments to expected format", function() {
			let file = getTestDataDirectory();
			file.append("empty.pdf");
			
			let attachment = Zotero.Items.get(Zotero.Attachments.importFromFile(file));
			attachment.setField('title', 'Empty');
			attachment.setField('accessDate', '2001-02-03 12:13:14');
			attachment.setField('url', 'http://example.com');
			attachment.setNote('Note');
			
			attachment.save();
			
			cslJSONAttachment = Zotero.Utilities.itemToCSLJSON(attachment);
			assert.equal(cslJSONAttachment.type, 'article', 'attachment is exported as "article"');
			assert.equal(cslJSONAttachment.title, 'Empty', 'attachment title is correct');
			assert.deepEqual(cslJSONAttachment.accessed, {"date-parts":[["2001",2,3]]}, 'attachment access date is mapped correctly');
		});
		it("should refuse to convert unexpected item types", function() {
			let data = populateDBWithSampleData(loadSampleData('journalArticle'));
			let item = Zotero.Items.get(data.journalArticle.id);
			
			let exportFormat = Zotero.Utilities.Internal.itemToExportFormat(item);
			exportFormat.itemType = 'foo';
			
			assert.throws(Zotero.Utilities.itemToCSLJSON.bind(Zotero.Utilities, exportFormat), /^Unexpected Zotero Item type ".*"$/, 'throws an error when trying to map invalid item types');
		});
		it("should map additional fields from Extra field", function() {
			let item = new Zotero.Item('journalArticle');
			item.setField('extra', 'PMID: 12345\nPMCID:123456');
			item = Zotero.Items.get(item.save());
			
			let cslJSON = Zotero.Utilities.itemToCSLJSON(item);
			
			assert.equal(cslJSON.PMID, '12345', 'PMID from Extra is mapped to PMID');
			assert.equal(cslJSON.PMCID, '123456', 'PMCID from Extra is mapped to PMCID');
			
			item.setField('extra', 'PMID: 12345');
			item.save();
			cslJSON = Zotero.Utilities.itemToCSLJSON(item);
			
			assert.equal(cslJSON.PMID, '12345', 'single-line entry is extracted correctly');
			
			item.setField('extra', 'some junk: note\nPMID: 12345\nstuff in-between\nPMCID: 123456\nlast bit of junk!');
			item.save();
			cslJSON = Zotero.Utilities.itemToCSLJSON(item);
			
			assert.equal(cslJSON.PMID, '12345', 'PMID from mixed Extra field is mapped to PMID');
			assert.equal(cslJSON.PMCID, '123456', 'PMCID from mixed Extra field is mapped to PMCID');
			
			item.setField('extra', 'a\n PMID: 12345\nfoo PMCID: 123456');
			item.save();
			cslJSON = Zotero.Utilities.itemToCSLJSON(item);
			
			assert.isUndefined(cslJSON.PMCID, 'field label must not be preceded by other text');
			assert.isUndefined(cslJSON.PMID, 'field label must not be preceded by a space');
			assert.equal(cslJSON.note, 'a\n PMID: 12345\nfoo PMCID: 123456', 'note is left untouched if nothing is extracted');
			
			item.setField('extra', 'something\npmid: 12345\n');
			item.save();
			cslJSON = Zotero.Utilities.itemToCSLJSON(item);
			
			assert.isUndefined(cslJSON.PMID, 'field labels are case-sensitive');
		});
	});
});
