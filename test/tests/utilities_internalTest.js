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
		it("should extract a field", function () {
			var val = '10.1234/abcdef';
			var str = `DOI: ${val}`;
			var fields = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI').value, val);
		});
		
		it("should extract a field with different case", function () {
			var val = '10.1234/abcdef';
			var str = `doi: ${val}`;
			var fields = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI').value, val);
		});
		
		it("should extract a field with other fields, text, and whitespace", function () {
			var originalDateVal = '1989';
			var doiVal = '10.1234/abcdef';
			var str = `\nOriginal Date: ${originalDateVal}\nDOI: ${doiVal}\n\n`;
			var fields = Zotero.Utilities.Internal.extractExtraFields(str);
			assert.equal(fields.size, 1);
			assert.equal(fields.get('DOI').value, doiVal);
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
