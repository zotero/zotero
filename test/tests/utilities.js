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
});
