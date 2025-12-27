/* global assert, describe, it, before, getTestDataDirectory, createDataObject, resetDB */

let { parseCitations, processCitations, replaceCitations, UNMAPPED, AMBIGUOUS, MAPPED } = ChromeUtils.importESModule("chrome://zotero/content/modules/rtf.mjs");

async function makeMatchingItems() {
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
	return {
		testItem1,
		testItem2
	};
}

describe("RTF Scan", function () {
	let basicRTF;

	before(async () => {
		await resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		basicRTF = (await Zotero.File.getContentsAsync(OS.Path.join(getTestDataDirectory().path, 'testRTFScanBasic.rtf')))
			.replace(/([^\\\r])\r?\n/, "$1 ")
			.replaceAll("\\'92", "'")
			.replaceAll("\\rquote ", "’");
	});
	
	it('should recognize citations in the RTF file', async () => {
		let citations = parseCitations(basicRTF);
		assert.lengthOf(citations, 7);
		assert.equal(citations[0].citationStrings[0], 'Smith, 2009');
		assert.equal(citations[0].data[0].creators, 'Smith');
		assert.isUndefined(citations[0].data[0].title);
		assert.equal(citations[0].data[0].date, '2009');
		assert.equal(citations[1].citationStrings[0], 'Smith {2009}');
		assert.equal(citations[1].data[0].creators, 'Smith');
		assert.isUndefined(citations[1].data[0].title);
		assert.equal(citations[1].data[0].date, '2009');
		assert.equal(citations[2].citationStrings[0], 'Smith et al., 2009');
		assert.equal(citations[2].data[0].creators, 'Smith');
		assert.isUndefined(citations[2].data[0].title);
		assert.equal(citations[2].data[0].date, '2009');
		assert.equal(citations[3].citationStrings[0], 'John Smith, 2009');
		assert.equal(citations[3].data[0].creators, 'John Smith');
		assert.isUndefined(citations[3].data[0].title);
		assert.equal(citations[3].data[0].date, '2009');
		assert.equal(citations[4].citationStrings[0], 'Smith, 2009');
		assert.equal(citations[4].pages[0], '10-14');
		assert.equal(citations[4].data[0].creators, 'Smith');
		assert.isUndefined(citations[4].data[0].title);
		assert.equal(citations[4].data[0].date, '2009');
		assert.equal(citations[5].citationStrings[0], 'Smith, "Title," 2009');
		assert.equal(citations[5].data[0].creators, 'Smith');
		assert.equal(citations[5].data[0].title, 'Title');
		assert.equal(citations[5].data[0].date, '2009');
		assert.equal(citations[6].citationStrings[0], 'Jones, 2005');
		assert.equal(citations[6].citationStrings[1], 'Smith, 2009');
		assert.equal(citations[6].data[0].creators, 'Jones');
		assert.equal(citations[6].data[1].creators, 'Smith');
		assert.isUndefined(citations[6].data[0].title);
		assert.isUndefined(citations[6].data[1].title);
		assert.equal(citations[6].data[0].date, '2005');
		assert.equal(citations[6].data[1].date, '2009');
	});
	
	it('should map citations to existing items, when matching items exist', async () => {
		// create items that match citations perfectly
		let { testItem1, testItem2 } = await makeMatchingItems();

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
		await testItem1.eraseTx();
		await testItem2.eraseTx();
	});

	it('should map mark mappings as AMBIGUOUS when more than one matching item is found', async () => {
		// create two items that both match "Smith, 2009"
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

		await testItem1.eraseTx();
		await testItem2.eraseTx();
	});
	
	it('should map unmapped citations to UNMAPPED', async () => {
		let citations = parseCitations(basicRTF);
		let mappings = await processCitations(citations);
		assert.equal(mappings[0].rtf, 'Smith, 2009');
		assert.lengthOf(mappings[0].items, 0);
		assert.equal(mappings[0].type, UNMAPPED);
	});
	
	it('should reformat RTF with citations in requested style', async () => {
		const style = "http://www.zotero.org/styles/harvard-cite-them-right";
		await Zotero.Styles.init();
		let { testItem1, testItem2 } = await makeMatchingItems();
		let citations = parseCitations(basicRTF);
		let mappings = await processCitations(citations);
		let citationItemIDs = Object.fromEntries(
			mappings.map(mapping => [mapping.rtf, [mapping.items[0].id]])
		);
		let processed = await replaceCitations(basicRTF, citations, citationItemIDs, style, 'en-US', 'endnotes');
		let basicRTFProcessed = await Zotero.File.getContentsAsync(
			OS.Path.join(getTestDataDirectory().path, 'testRTFScanBasicProcessed.rtf')
		);
		assert.equal(processed, basicRTFProcessed);
		await testItem1.eraseTx();
		await testItem2.eraseTx();
	});
});
