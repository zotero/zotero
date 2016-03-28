"use strict";

describe("Zotero.Utilities.Internal", function () {
	describe("#md5Async()", function () {
		it("should generate hex string given file path", function* () {
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			yield assert.eventually.equal(
				Zotero.Utilities.Internal.md5Async(file),
				'93da8f1e5774c599f0942dcecf64b11c'
			);
		})
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
			spy.reset();
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
				spy.reset();
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
				spy.reset();
			}
			
			// Another interval would put us over maxTime, so return false immediately
			let val = yield gen.next().value;
			assert.isFalse(val);
			assert.isFalse(spy.called);
		});
	})
})
