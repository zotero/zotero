"use strict";

describe("Zotero.Utilities.Internal", function () {
	var ZUI;
		
	before(function () {
		ZUI = Zotero.Utilities.Internal;
	});
	
	
	
	describe("#md5()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			assert.equal(
				Zotero.Utilities.Internal.md5(Zotero.File.pathToFile(file)),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		})
	})
	
	
	describe("#md5Async()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		});
		
		it("should generate hex string given file path for file bigger than chunk size", function* () {
			var tmpDir = Zotero.getTempDirectory().path;
			var file = OS.Path.join(tmpDir, 'md5Async');
			
			let encoder = new TextEncoder();
			let arr = encoder.encode("".padStart(100000, "a"));
			yield OS.File.writeAtomic(file, arr);
			
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'1af6d6f2f682f76f80e606aeaaee1680'
			);
			
			yield OS.File.remove(file);
		});
	})
	
	
	describe("#gzip()/gunzip()", function () {
		it("should compress and decompress a Unicode text string", function* () {
			var text = "Voilà! \u1F429";
			var compstr = yield Zotero.Utilities.Internal.gzip(text);
			assert.isAbove(compstr.length, 0);
			assert.notEqual(compstr.length, text.length);
			var str = yield Zotero.Utilities.Internal.gunzip(compstr);
			assert.equal(str, text);
		});
	});
	
	
	describe("#delayGenerator", function () {
		var spy;
		
		before(function () {
			spy = sinon.spy(Zotero.Promise, "delay");
		});
		
		afterEach(function () {
			spy.resetHistory();
		});
		
		after(function () {
			spy.restore();
		});
		
		it("should delay for given amounts of time without limit", function* () {
			var intervals = [1, 2];
			var gen = Zotero.Utilities.Internal.delayGenerator(intervals);
			
			// When intervals are exhausted, keep using last interval
			var testIntervals = intervals.slice();
			testIntervals.push(intervals[intervals.length - 1]);
			
			for (let i of testIntervals) {
				let val = yield gen.next().value;
				assert.isTrue(val);
				assert.isTrue(spy.calledWith(i));
				spy.resetHistory();
			}
		});
		
		it("should return false when maxTime is reached", function* () {
			var intervals = [5, 10];
			var gen = Zotero.Utilities.Internal.delayGenerator(intervals, 30);
			
			// When intervals are exhausted, keep using last interval
			var testIntervals = intervals.slice();
			testIntervals.push(intervals[intervals.length - 1]);
			
			for (let i of testIntervals) {
				let val = yield gen.next().value;
				assert.isTrue(val);
				assert.isTrue(spy.calledWith(i));
				spy.resetHistory();
			}
			
			// Another interval would put us over maxTime, so return false immediately
			let val = yield gen.next().value;
			assert.isFalse(val);
			assert.isFalse(spy.called);
		});
	});
	
	
	describe("#extractExtraFields()", function () {
		it("should extract a CSL type", function () {
			var str = 'type: motion_picture';
			var { itemType, fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(itemType, 'videoRecording');
			assert.equal(fields.size, 0);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field", function () {
			var val = '10.1234/abcdef';
			var str = `DOI: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field for a given item", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var val = '10.1234/abcdef';
			var str = `DOI: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL field", function () {
			var val = '10.1234/abcdef';
			var str = `container-title: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, Zotero.Schema.CSL_TEXT_MAPPINGS['container-title'].length);
			assert.equal(fields.get('publicationTitle'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL field for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var val = '10.1234/abcdef';
			var str = `container-title: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('publicationTitle'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field with different case", function () {
			var val = '10.1234/abcdef';
			var str = `doi: ${val}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI'), val);
			assert.strictEqual(extra, '');
		});
		
		it("should extract a field with other fields, text, and whitespace", function () {
			var place = 'New York';
			var doi = '10.1234/abcdef';
			var str = `Line 1\nPublisher Place: ${place}\nFoo: Bar\nDOI: ${doi}\n\nLine 2`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 2);
			assert.equal(fields.get('DOI'), doi);
			assert.equal(fields.get('place'), place);
			assert.equal(extra, 'Line 1\nFoo: Bar\n\nLine 2');
		});
		
		it("should extract the first instance of a field", function () {
			var place1 = 'New York';
			var place2 = 'London';
			var str = `Publisher Place: ${place1}\nPublisher Place: ${place2}`;
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('place'), place1);
			assert.equal(extra, "Publisher Place: " + place2);
		});
		
		it("shouldn't extract a field from a line that begins with a whitespace", function () {
			var str = '\n number-of-pages: 11';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 0);
		});
		
		it("shouldn't extract a field that already exists on the item", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setField('numPages', 10);
			var str = 'number-of-pages: 11';
			var { fields, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 0);
		});
		
		it("should extract an author and add it to existing creators", function () {
			var item = createUnsavedDataObject('item', { itemType: 'book' });
			item.setCreator(0, { creatorType: 'author', name: 'Foo' });
			var str = 'author: Bar';
			var { fields, creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.equal(fields.size, 0);
			assert.lengthOf(creators, 1);
			assert.equal(creators[0].creatorType, 'author');
			assert.equal(creators[0].name, 'Bar');
		});
		
		it("should extract a CSL name", function () {
			var str = 'container-author: First || Last';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.lengthOf(creators, 1);
			assert.propertyVal(creators[0], 'creatorType', 'bookAuthor');
			assert.propertyVal(creators[0], 'firstName', 'First');
			assert.propertyVal(creators[0], 'lastName', 'Last');
			assert.strictEqual(extra, '');
		});
		
		it("should extract a CSL name that's valid for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'bookSection' });
			var str = 'container-author: First || Last';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.lengthOf(creators, 1);
			assert.propertyVal(creators[0], 'creatorType', 'bookAuthor');
			assert.propertyVal(creators[0], 'firstName', 'First');
			assert.propertyVal(creators[0], 'lastName', 'Last');
			assert.strictEqual(extra, '');
		});
		
		it("shouldn't extract a CSL name that's not valid for a given item type", function () {
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			var str = 'container-author: First || Last';
			var { creators, extra } = Zotero.Utilities.Internal.extractExtraFields(str, item);
			assert.lengthOf(creators, 0);
			assert.strictEqual(extra, str);
		});
	});
	
	describe("#combineExtraFields", function () {
		var originalDate = "1887";
		var publicationPlace = "New York";
		var doi = '10.1234/123456789';
		var fieldMap = new Map();
		fieldMap.set('originalDate', originalDate);
		fieldMap.set('publicationPlace', publicationPlace);
		fieldMap.set('DOI', doi);
		var fieldStr = `DOI: ${doi}\noriginalDate: ${originalDate}\npublicationPlace: ${publicationPlace}`;
		
		it("should create 'field: value' pairs from field map", function () {
			var extra = "";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(newExtra, fieldStr);
		});
		
		it("should add fields above existing Extra content", function () {
			var extra = "This is a note.";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(newExtra, fieldStr + '\n' + extra);
		});
		
		it("should replace existing fields", function () {
			var extra = "This is a note.\nOriginal Date: 1886\nFoo: Bar";
			var newExtra = ZUI.combineExtraFields(extra, fieldMap);
			assert.equal(
				newExtra,
				fieldStr.split(/\n/).filter(x => !x.startsWith('originalDate')).join("\n")
					+ "\nThis is a note.\nOriginal Date: 1887\nFoo: Bar"
			);
		});
	});
	
	describe("#extractIdentifiers()", function () {
		it("should extract ISBN-10", async function () {
			var id = "0838985890";
			var identifiers = ZUI.extractIdentifiers(id);
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "ISBN", id);
		});
		
		it("should extract ISBN-13", async function () {
			var identifiers = ZUI.extractIdentifiers("978-0838985892");
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "ISBN", "9780838985892");
		});
		
		it("should extract multiple ISBN-13s", async function () {
			var identifiers = ZUI.extractIdentifiers("978-0838985892 9781479347711 ");
			assert.lengthOf(identifiers, 2);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.propertyVal(identifiers[0], "ISBN", "9780838985892");
			assert.propertyVal(identifiers[1], "ISBN", "9781479347711");
		});
		
		it("should extract DOI", async function () {
			var id = "10.4103/0976-500X.85940";
			var identifiers = ZUI.extractIdentifiers(id);
			assert.lengthOf(identifiers, 1);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.propertyVal(identifiers[0], "DOI", id);
		});
		
		it("should extract PMID", async function () {
			var identifiers = ZUI.extractIdentifiers("1 PMID:24297125,222 3-4 1234567890, 123456789");
			assert.lengthOf(identifiers, 4);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.lengthOf(Object.keys(identifiers[2]), 1);
			assert.lengthOf(Object.keys(identifiers[3]), 1);
			assert.propertyVal(identifiers[0], "PMID", "1");
			assert.propertyVal(identifiers[1], "PMID", "24297125");
			assert.propertyVal(identifiers[2], "PMID", "222");
			assert.propertyVal(identifiers[3], "PMID", "123456789");
		});
		
		it("should extract multiple old and new style arXivs", async function () {
			var identifiers = ZUI.extractIdentifiers("0706.0044 arXiv:0706.00441v1,12345678,hep-ex/9809001v1, math.GT/0309135.");
			assert.lengthOf(identifiers, 4);
			assert.lengthOf(Object.keys(identifiers[0]), 1);
			assert.lengthOf(Object.keys(identifiers[1]), 1);
			assert.lengthOf(Object.keys(identifiers[2]), 1);
			assert.lengthOf(Object.keys(identifiers[3]), 1);
			assert.propertyVal(identifiers[0], "arXiv", "0706.0044");
			assert.propertyVal(identifiers[1], "arXiv", "0706.00441");
			assert.propertyVal(identifiers[2], "arXiv", "hep-ex/9809001");
			assert.propertyVal(identifiers[3], "arXiv", "math.GT/0309135");
		});
	});
	
	describe("#resolveLocale()", function () {
		var availableLocales;
		
		before(function () {
			availableLocales = Services.locale.getAvailableLocales();
		});
		
		function resolve(locale) {
			return Zotero.Utilities.Internal.resolveLocale(locale, availableLocales);
		}
		
		it("should return en-US for en-US", function () {
			assert.equal(resolve('en-US'), 'en-US');
		});
		
		it("should return en-US for en", function () {
			assert.equal(resolve('en'), 'en-US');
		});
		
		it("should return fr-FR for fr-FR", function () {
			assert.equal(resolve('fr-FR'), 'fr-FR');
		});
		
		it("should return fr-FR for fr", function () {
			assert.equal(resolve('fr'), 'fr-FR');
		});
		
		it("should return ar for ar", function () {
			assert.equal(resolve('ar'), 'ar');
		});
		
		it("should return pt-PT for pt", function () {
			assert.equal(resolve('pt'), 'pt-PT');
		});
		
		it("should return zh-CN for zh-CN", function () {
			assert.equal(resolve('zh-CN'), 'zh-CN');
		});
		
		it("should return zh-TW for zh-TW", function () {
			assert.equal(resolve('zh-TW'), 'zh-TW');
		});
		
		it("should return zh-CN for zh", function () {
			assert.equal(resolve('zh'), 'zh-CN');
		});
	});
	
	describe("#getNextName()", function () {
		it("should get the next available numbered name", function () {
			var existing = ['Name', 'Name 1', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name 2');
		});
		
		it("should return 'Name 1' if no numbered names", function () {
			var existing = ['Name'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name 1');
		});
		
		it("should return 'Name' if only numbered names", function () {
			var existing = ['Name 1', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name', existing), 'Name');
		});
		
		it("should trim given name if trim=true", function () {
			var existing = ['Name', 'Name 1', 'Name 2', 'Name 3'];
			assert.equal(Zotero.Utilities.Internal.getNextName('Name 2', existing, true), 'Name 4');
		});
	});
})
