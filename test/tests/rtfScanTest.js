/* global assert, describe, it, before, beforeEach, afterEach, getTestDataDirectory, createDataObject, resetDB */

let { decodeHex, decodeRTF, encodeRTF, parseCitations, processCitations, replaceCitations, UNMAPPED, AMBIGUOUS, MAPPED } = ChromeUtils.importESModule("chrome://zotero/content/modules/rtf.mjs");

async function makeItems() {
	let testItem1 = await createDataObject('item');
	testItem1.setField('title', 'Title');
	testItem1.setField('date', '2009');
	testItem1.setCreators([{
		lastName: 'Smith',
		firstName: 'John',
		creatorType: 'author'
	}, {
		lastName: 'Jones',
		firstName: 'Jane',
		creatorType: 'author',
	}]);
	await testItem1.saveTx();
	let testItem2 = await createDataObject('item');
	testItem2.setField('title', 'Lorem Ipsum');
	testItem2.setField('date', '2005');
	testItem2.setCreators([{
		lastName: 'Jones',
		firstName: 'Jane',
		creatorType: 'author'
	}]);
	await testItem2.saveTx();
	
	let testItem3 = await createDataObject('item');
	testItem3.setField('title', 'Foobar');
	testItem3.setField('date', '2012');
	testItem3.setCreators([{
		lastName: 'Müller',
		firstName: 'Johann',
		creatorType: 'author'
	}]);
	await testItem3.saveTx();

	let testItem4 = await createDataObject('item');
	testItem3.setField('title', 'どの犬が一番いい子？');
	testItem3.setField('date', '2019');
	testItem3.setCreators([{
		lastName: '山本',
		firstName: '春樹',
		creatorType: 'author'
	}]);
	await testItem4.saveTx();
	
	let testItem5 = await createDataObject('item');
	testItem5.setField('title', '金毛寻回犬');
	testItem5.setField('date', '2010');
	testItem5.setCreators([{
		lastName: 'Smith',
		firstName: 'John',
		creatorType: 'author'
	}]);
	await testItem5.saveTx();
	

	return [
		testItem1,
		testItem2,
		testItem3,
		testItem4,
		testItem5
	];
}

async function clearItems(items){
	for (let item of items) {
		await item.eraseTx();
	}
}

describe('RTF processing', () => {
	describe('decodeHex', () => {
		it('should convert ANSI symbols to Unicode', () => {
			assert.equal(decodeHex("a5", 'windows-1250'), "Ą");
			assert.equal(decodeHex("A5", 'windows-1250'), "Ą");
			assert.equal(decodeHex("a5", 'windows-1252'), "¥");
			assert.equal(decodeHex("a5", 'INVALID'), "?"); // falls back to "?"
		});
	});
	describe('decodeRTF', () => {
		it('should convert RTF-escaped string to Unicode', () => {
			assert.equal(decodeRTF(String.raw`M\'fcller`, 'windows-1252'), "Müller");
			assert.equal(decodeRTF(String.raw`za\'bf\'f3\'b3\'e6`, "windows-1250"), "zażółć");
			assert.equal(decodeRTF(String.raw`\u913?\u952?\u942?\u957?\u945?`), "Αθήνα");
			assert.equal(decodeRTF(String.raw`\u55357?\u56832?\u55357?\u56960?`), "😀🚀");
			assert.equal(decodeRTF(String.raw`\uc0\u55357\u56832\u55357\u56960`), "😀🚀");
		});

		it('should not affect literal backslash', () => {
			assert.equal(decodeRTF(String.raw`\\'ab`), String.raw`\\'ab`);
			assert.equal(decodeRTF(String.raw`\\u913`), String.raw`\\u913`);
			assert.equal(decodeRTF(String.raw`\\uc9`), String.raw`\\uc9`);
		});

		it('should track current value of fallback characters', () => {
			assert.equal(decodeRTF(String.raw`\u913?{\uc0\u952\u942\uc2{\u957??}\u945??}`), "Α{θή{ν}α}");
		});
		
		it('should keep track of the current codepage', () => {
			// F1 is ń in windows-1250 and ñ in windows-1252
			assert.equal(decodeRTF(String.raw`\ansicpg1250ko\'f1\ansicpg1252ni\'f1o{\ansicpg1250\'F1}\'F1`), String.raw`\ansicpg1250koń\ansicpg1252niño{\ansicpg1250ń}ñ`);
		});
		it('should keep track of the font id and handle multi-byte encoded characters', () => {
			// fcharset128 is a windows-932 codepage legacy multibyte encoding.
			const fontTableJapanese = String.raw`{\fonttbl{\f0\fnil\fcharset0 Times New Roman;}{\f1\fnil\fcharset128 HiraMinProN-W3;}}`;
			assert.equal(
				decodeRTF(String.raw`${fontTableJapanese}\'93\'fa\'96\'7b\'8c\'ea\f1\'93\'fa\'96\'7b\'8c\'ea`),
				String.raw`${fontTableJapanese}“ú–{Œê\f1日本語`
			);
			
			// fcharset129 is a windows-949 codepage legacy multibyte encoding.
			const fontTableKorean = String.raw`{\fonttbl\f0\fnil\fcharset129 AppleSDGothicNeo-Regular;\f1\fswiss\fcharset0 Helvetica;}`;
			assert.equal(
				decodeRTF(String.raw`${fontTableKorean}\f0\'b0\'f1\'b5\'e7\'b8\'ae\'c6\'ae\'b8\'ae\'b9\'f6 ASCII works too`),
				String.raw`${fontTableKorean}\f0골든리트리버 ASCII works too`
			);
			
			// GBK/windows-936 codepage legacy multibyte encoding.
			const fontTableChinese = String.raw`{\fonttbl\f0\fnil\fcharset134 SimSun;}`;
			assert.equal(
				decodeRTF(String.raw`${fontTableChinese}\f0\'bc\'f2\'cc\'e5\'d6\'d0\'ce\'c4`),
				String.raw`${fontTableChinese}\f0简体中文`
			);
			
			// Big5
			const fontTableBig5 = String.raw`{\fonttbl\f0\fnil\fcharset136 MingLiU;}`;
			assert.equal(
				decodeRTF(String.raw`${fontTableBig5}\f0\'C1\'63\'C5\'E9\'A4\'A4\'A4\'E5`),
				String.raw`${fontTableBig5}\f0繁體中文`
			);
			
			// Greek
			const fontTableGreek = String.raw`{\fonttbl\f0\fnil\fcharset161 Arial;}`;
			assert.equal(
				decodeRTF(String.raw`${fontTableGreek}\f0\'c5\'eb\'eb\'e7\'ed\'e9\'ea\'dc`),
				String.raw`${fontTableGreek}\f0Ελληνικά`
			);
		});
		
		it('should respect the default font id', () => {
			const fontTableJapanese = String.raw`{\fonttbl{\f0\fnil\fcharset0 Times New Roman;}{\f1\fnil\fcharset128 HiraMinProN-W3;}}`;
			assert.equal(
				decodeRTF(String.raw`\deff1${fontTableJapanese}\'93\'fa\'96\'7b\'8c\'ea`),
				String.raw`\deff1${fontTableJapanese}日本語`
			);
		});
	});

	describe('encodeRTF', () => {
		it('should convert Unicode string to RTF-escaped', () => {
			const golden = String.raw`\rtf1金毛寻回犬`;
			assert.equal(decodeRTF(encodeRTF(golden)), golden);

			const mullerRTF = String.raw`M\'fcller`; // "\'xx" is codepage-based encoding, we convert it to Unicode
			assert.equal(decodeRTF(mullerRTF), 'Müller');
			assert.equal(encodeRTF(String.raw`{\rtf1Müller}`), String.raw`{\rtf1\uc0M\u252ller}`);
		});
	});
});

describe("RTF Scan", function () {
	let basicRTF, advancedRTF, items;

	before(async () => {
		await resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		basicRTF = decodeRTF(await Zotero.File.getContentsAsync(
			OS.Path.join(getTestDataDirectory().path, 'testRTFScanBasic.rtf')
		));

		advancedRTF = decodeRTF(await Zotero.File.getContentsAsync(
			OS.Path.join(getTestDataDirectory().path, 'testRTFScanAdvanced.rtf')
		));
	});
	
	beforeEach(async () => {
		items = await makeItems();
	});
	
	afterEach(async () => {
		await clearItems(items);
	});

	it('should recognize citations in the RTF file', async () => {
		let citations = parseCitations(basicRTF);
		assert.lengthOf(citations, 7);
		
		assert.lengthOf(citations[0].citationStrings, 1);
		assert.equal(citations[0].citationStrings[0], 'Smith, 2009');
		assert.equal(citations[0].data[0].creators, 'Smith');
		assert.isUndefined(citations[0].data[0].title);
		assert.equal(citations[0].data[0].date, '2009');
		assert.isFalse(citations[0].suppressAuthor);
		
		assert.lengthOf(citations[1].citationStrings, 1);
		assert.equal(citations[1].citationStrings[0], 'Smith {2009}');
		assert.equal(citations[1].data[0].creators, 'Smith');
		assert.isUndefined(citations[1].data[0].title);
		assert.equal(citations[1].data[0].date, '2009');
		assert.isTrue(citations[1].suppressAuthor);
		
		assert.lengthOf(citations[2].citationStrings, 1);
		assert.equal(citations[2].citationStrings[0], 'Smith et al., 2009');
		assert.equal(citations[2].data[0].creators, 'Smith');
		assert.isUndefined(citations[2].data[0].title);
		assert.equal(citations[2].data[0].date, '2009');
		assert.isFalse(citations[2].suppressAuthor);
		
		assert.lengthOf(citations[3].citationStrings, 1);
		assert.equal(citations[3].citationStrings[0], 'John Smith, 2009');
		assert.equal(citations[3].data[0].creators, 'John Smith');
		assert.isUndefined(citations[3].data[0].title);
		assert.equal(citations[3].data[0].date, '2009');
		assert.isFalse(citations[3].suppressAuthor);

		assert.lengthOf(citations[4].citationStrings, 1);
		assert.equal(citations[4].citationStrings[0], 'Smith, 2009');
		assert.equal(citations[4].pages[0], '10-14');
		assert.equal(citations[4].data[0].creators, 'Smith');
		assert.isUndefined(citations[4].data[0].title);
		assert.equal(citations[4].data[0].date, '2009');
		assert.isFalse(citations[4].suppressAuthor);

		assert.lengthOf(citations[5].citationStrings, 1);
		assert.equal(citations[5].citationStrings[0], 'Smith, "Title," 2009');
		assert.equal(citations[5].data[0].creators, 'Smith');
		assert.equal(citations[5].data[0].title, 'Title');
		assert.equal(citations[5].data[0].date, '2009');
		assert.isFalse(citations[5].suppressAuthor);

		assert.lengthOf(citations[6].citationStrings, 2);
		assert.equal(citations[6].citationStrings[0], 'Jones, 2005');
		assert.equal(citations[6].citationStrings[1], 'Smith, 2009');
		assert.equal(citations[6].data[0].creators, 'Jones');
		assert.equal(citations[6].data[1].creators, 'Smith');
		assert.isUndefined(citations[6].data[0].title);
		assert.isUndefined(citations[6].data[1].title);
		assert.equal(citations[6].data[0].date, '2005');
		assert.equal(citations[6].data[1].date, '2009');
		assert.isFalse(citations[6].suppressAuthor);
	});
	
	it('should map citations to existing items, when matching items exist', async () => {
		// create items that match citations perfectly
		let [testItem1, testItem2, ..._] = items;

		let citations = parseCitations(basicRTF);
		let mappings = await processCitations(citations);
		assert.lengthOf(citations, 7);
		// 7 citations out of which one quotes two items give a total of 8 items,
		// but "Smith, 2009" appears multiple times, which makes it 6 after deduplication.
		assert.lengthOf(mappings, 6);
		assert.equal(mappings[0].rtf, 'Smith, 2009');
		assert.lengthOf(mappings[0].items, 1);
		assert.equal(mappings[0].items[0].id, testItem1.id);
		assert.equal(mappings[0].type, MAPPED);
		assert.equal(mappings[1].rtf, 'Smith {2009}');
		assert.lengthOf(mappings[1].items, 1);
		assert.equal(mappings[1].items[0].id, testItem1.id);
		assert.equal(mappings[1].type, MAPPED);
		assert.equal(mappings[2].rtf, 'Smith et al., 2009');
		assert.lengthOf(mappings[2].items, 1);
		assert.equal(mappings[2].items[0].id, testItem1.id);
		assert.equal(mappings[2].type, MAPPED);
		assert.equal(mappings[3].rtf, 'John Smith, 2009');
		assert.lengthOf(mappings[3].items, 1);
		assert.equal(mappings[3].items[0].id, testItem1.id);
		assert.equal(mappings[3].type, MAPPED);
		assert.equal(mappings[4].rtf, 'Smith, "Title," 2009');
		assert.lengthOf(mappings[4].items, 1);
		assert.equal(mappings[4].items[0].id, testItem1.id);
		assert.equal(mappings[4].type, MAPPED);
		assert.equal(mappings[5].rtf, 'Jones, 2005');
		assert.lengthOf(mappings[5].items, 1);
		assert.equal(mappings[5].items[0].id, testItem2.id);
		assert.equal(mappings[5].type, MAPPED);
	});

	it('should map mark mappings as AMBIGUOUS when more than one matching item is found', async () => {
		// clear matching items, then create two items that both match "Smith, 2009"
		await clearItems(items);
		let testItem1 = await createDataObject('item');
		testItem1.setField('title', 'First Title');
		testItem1.setField('date', '2009');
		testItem1.setCreators([{
			lastName: 'Smith',
			firstName: 'John',
			creatorType: 'author'
		}]);
		await testItem1.saveTx();

		let testItem2 = await createDataObject('item');
		testItem2.setField('title', 'Second Title');
		testItem2.setField('date', '2009');
		testItem2.setCreators([{
			lastName: 'Smith',
			firstName: 'Jane',
			creatorType: 'author'
		}]);
		await testItem2.saveTx();

		let citations = parseCitations(basicRTF);
		let mappings = await processCitations(citations);

		assert.equal(mappings[0].rtf, 'Smith, 2009');
		assert.lengthOf(mappings[0].items, 2);
		assert.include([mappings[0].items[0].id, mappings[0].items[1].id], testItem1.id);
		assert.include([mappings[0].items[0].id, mappings[0].items[1].id], testItem2.id);
		assert.equal(mappings[0].type, AMBIGUOUS);

		// clean up items created for this test
		await testItem1.eraseTx();
		await testItem2.eraseTx();
	});
	
	it('should map unmapped citations to UNMAPPED', async () => {
		// ensure no matching items exist beforehand
		await clearItems(items);
		let citations = parseCitations(basicRTF);
		let mappings = await processCitations(citations);
		assert.equal(mappings[0].rtf, 'Smith, 2009');
		assert.lengthOf(mappings[0].items, 0);
		assert.equal(mappings[0].type, UNMAPPED);
	});
	
	it('should recognize citations with Unicode in the RTF file', async () => {
		let citations = parseCitations(advancedRTF);
		// total number of citations
		assert.lengthOf(citations, 16);

		// 0 - Unicode Names: Müller, 2012 / 山本, 2019
		assert.lengthOf(citations[0].citationStrings, 2);
		assert.equal(citations[0].citationStrings[0], "Müller, 2012");
		assert.equal(citations[0].citationStrings[1], "山本, 2019");
		assert.equal(citations[0].data[0].creators, "Müller");
		assert.equal(citations[0].data[1].creators, "山本");
		assert.equal(citations[0].data[0].date, "2012");
		assert.equal(citations[0].data[1].date, "2019");
		assert.isFalse(citations[0].suppressAuthor);

		// 1 - Compound names: O’Connor, "Drink Before the War", 1987
		assert.lengthOf(citations[1].citationStrings, 1);
		assert.equal(
			citations[1].citationStrings[0],
			"O’Connor, \"Drink Before the War\", 1987"
		);
		assert.equal(citations[1].data[0].creators, "O’Connor");
		assert.equal(citations[1].data[0].date, "1987");
		assert.isFalse(citations[1].suppressAuthor);

		// 2 - Unicode titles: Smith, "金毛寻回犬," 2010
		assert.lengthOf(citations[2].citationStrings, 1);
		assert.equal(
			citations[2].citationStrings[0],
			"Smith, \"金毛寻回犬,\" 2010"
		);
		assert.equal(citations[2].data[0].creators, "Smith");
		assert.equal(citations[2].data[0].date, "2010");

		// 3 - ASCII quotes with comma outside: Smith, "Title", 2008
		assert.lengthOf(citations[3].citationStrings, 1);
		assert.equal(
			citations[3].citationStrings[0],
			"Smith, \"Title\", 2008"
		);
		assert.equal(citations[3].data[0].creators, "Smith");
		assert.equal(citations[3].data[0].date, "2008");

		// 4 - Unicode quotes: Smith, “Title,” 2009
		assert.lengthOf(citations[4].citationStrings, 1);
		assert.equal(
			citations[4].citationStrings[0],
			"Smith, “Title,” 2009"
		);
		assert.equal(citations[4].data[0].creators, "Smith");
		assert.equal(citations[4].data[0].date, "2009");

		// 5 - Unicode quotes with comma outside: Smith, “Title”, 2009
		assert.lengthOf(citations[5].citationStrings, 1);
		assert.equal(
			citations[5].citationStrings[0],
			"Smith, “Title”, 2009"
		);
		assert.equal(citations[5].data[0].creators, "Smith");
		assert.equal(citations[5].data[0].date, "2009");

		// 6 - Low/High quotes: Smith, „Title”, 2009
		assert.lengthOf(citations[6].citationStrings, 1);
		assert.equal(
			citations[6].citationStrings[0],
			"Smith, „Title”, 2009"
		);
		assert.equal(citations[6].data[0].creators, "Smith");
		assert.equal(citations[6].data[0].date, "2009");

		// 7 - Just the title: "Title," 2009 (no creators)
		assert.lengthOf(citations[7].citationStrings, 1);
		assert.equal(
			citations[7].citationStrings[0],
			"\"Title,\" 2009"
		);
		assert.isUndefined(citations[7].data[0].creators);
		assert.equal(citations[7].data[0].date, "2009");

		// 8 - Just the title, comma outside: "Title", 2009 (no creators)
		assert.lengthOf(citations[8].citationStrings, 1);
		assert.equal(
			citations[8].citationStrings[0],
			"\"Title\", 2009"
		);
		assert.isUndefined(citations[8].data[0].creators);
		assert.equal(citations[8].data[0].date, "2009");

		// 9 - Just the title, Unicode quotes: “Title,” 2009 (no creators)
		assert.lengthOf(citations[9].citationStrings, 1);
		assert.equal(
			citations[9].citationStrings[0],
			"“Title,” 2009"
		);
		assert.isUndefined(citations[9].data[0].creators);
		assert.equal(citations[9].data[0].date, "2009");
		
		// 10 - Initials: J.R.R Tolkien, 1954
		assert.lengthOf(citations[10].citationStrings, 1);
		assert.equal(citations[10].citationStrings[0], "J.R.R. Tolkien, 1954");
		assert.equal(citations[10].data[0].creators, "J.R.R. Tolkien");
		assert.equal(citations[10].data[0].date, "1954");
		
		// 11 - More compound names: van Buuren, 2008
		assert.lengthOf(citations[11].citationStrings, 1);
		assert.equal(citations[11].citationStrings[0], "van Buuren, 2008");
		assert.equal(citations[11].data[0].creators, "van Buuren");
		assert.equal(citations[11].data[0].date, "2008");
		
		// 12 - Formatting inside a citation: Smith, 2009
		assert.lengthOf(citations[12].citationStrings, 1);
		assert.equal(citations[12].citationStrings[0], "Smith, 2009");
		assert.equal(citations[12].data[0].creators, "Smith");
		assert.equal(citations[12].data[0].date, "2009");
		
		// 13 - legacy multibyte encodings: Smith and Jones, 2010
		assert.lengthOf(citations[13].citationStrings, 1);
		assert.equal(citations[13].citationStrings[0], "Smith, \"金毛寻回犬,\" 2010");
		assert.equal(citations[13].data[0].creators, "Smith");
		assert.equal(citations[13].data[0].date, "2010");
		
		// 14 - suppressed citations with Unicode characters: 山本, 2019
		assert.lengthOf(citations[14].citationStrings, 1);
		assert.equal(citations[14].citationStrings[0], "山本 et al. {2019}");
		assert.equal(citations[14].data[0].creators, "山本");
		assert.equal(citations[14].data[0].date, "2019");
		assert.isTrue(citations[14].suppressAuthor);
		
		// 15 - Unicode characters with a fallback character: Smith, 2010
		assert.lengthOf(citations[15].citationStrings, 1);
		assert.equal(citations[15].citationStrings[0], "Smith, \"金毛寻回犬,\" 2010");
		assert.equal(citations[15].data[0].creators, "Smith");
		assert.equal(citations[15].data[0].date, "2010");
		assert.isFalse(citations[15].suppressAuthor);
	});
});
