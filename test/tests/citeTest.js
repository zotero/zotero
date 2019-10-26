describe("Zotero.Cite", function () {
	describe("#extraToCSL()", function () {
		it("should convert Extra field values to the more restrictive citeproc-js cheater syntax", function () {
			var str1 = 'Original Date: 2017\n' // uppercase/spaces converted to lowercase/hyphens
				+ 'Archive-Place: New York\n' // allow hyphen even with title case
				+ 'Container title: Title\n' // mixed case
				+ 'DOI: 10.0/abc\n' // certain fields are uppercase
				+ 'Archive Location: Foo\n' // requires an underscore
				+ 'Original Publisher Place:  London, UK\n' // extra space OK
				+ 'Type: dataset'
				+ '\n\n'
				+ "Ignore other strings: they're not fields\n"
				+ 'This is just some text.'
			var str2 = 'original-date: 2017\n'
				+ 'archive-place: New York\n'
				+ 'container-title: Title\n'
				+ 'DOI: 10.0/abc\n'
				+ 'archive_location: Foo\n'
				+ 'original-publisher-place:  London, UK\n'
				+ 'type: dataset'
				+ '\n\n'
				+ "Ignore other strings: they're not fields\n"
				+ 'This is just some text.';
			assert.equal(Zotero.Cite.extraToCSL(str1), str2);
		});
	});
});
