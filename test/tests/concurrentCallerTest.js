"use strict";

describe("ConcurrentCaller", function () {
	Components.utils.import("resource://zotero/concurrentCaller.js");
	var logger = null;
	// Uncomment to get debug output
	//logger = Zotero.debug;
	
	describe("#start()", function () {
		it("should run functions as slots open and wait for them to complete", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
			var funcs = ids.map(function (id) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++;
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					var min = 10;
					var max = 25;
					yield Zotero.Promise.delay(
						Math.floor(Math.random() * (max - min + 1)) + min
					);
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			})
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var results = yield caller.start(funcs);
			
			assert.equal(results.length, ids.length);
			assert.equal(running, 0);
			assert.equal(finished, ids.length);
			assert.isFalse(failed);
		})
		
		it("should add functions to existing queue and resolve when all are complete (waiting for earlier set)", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids1 = {"1": 5, "2": 10, "3": 7};
			var ids2 = {"4": 50, "5": 50};
			var makeFunc = function (id, delay) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++;
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					yield Zotero.Promise.delay(delay);
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			};
			var keys1 = Object.keys(ids1);
			var keys2 = Object.keys(ids2);
			var funcs1 = Object.keys(ids1).map(id => makeFunc(id, ids1[id]));
			var funcs2 = Object.keys(ids2).map(id => makeFunc(id, ids2[id]));
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var promise1 = caller.start(funcs1);
			yield Zotero.Promise.delay(1);
			var promise2 = caller.start(funcs2);
			
			// Wait for first set
			var results1 = yield promise1;
			
			// Second set shouldn't be done yet
			assert.isFalse(promise2.isFulfilled());
			assert.equal(finished, keys1.length);
			assert.equal(results1.length, keys1.length);
			assert.sameMembers(results1.map(p => p.value()), keys1);
			assert.isFalse(failed);
		})
		
		it("should add functions to existing queue and resolve when all are complete (waiting for later set)", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids1 = {"1": 100, "2": 45, "3": 80};
			var ids2 = {"4": 1, "5": 1};
			var makeFunc = function (id, delay) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++;
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					yield Zotero.Promise.delay(delay);
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			};
			var keys1 = Object.keys(ids1);
			var keys2 = Object.keys(ids2);
			var funcs1 = Object.keys(ids1).map(id => makeFunc(id, ids1[id]));
			var funcs2 = Object.keys(ids2).map(id => makeFunc(id, ids2[id]));
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var promise1 = caller.start(funcs1);
			yield Zotero.Promise.delay(10);
			var promise2 = caller.start(funcs2);
			
			// Wait for second set
			var results2 = yield promise2;
			
			// The second set should finish before the first
			assert.isFalse(promise1.isFulfilled());
			assert.equal(running, 1); // 3 should still be running
			assert.equal(finished, 4); // 1, 2, 4, 5
			assert.equal(results2.length, keys2.length);
			assert.equal(results2[0].value(), keys2[0]);
			assert.equal(results2[1].value(), keys2[1]);
			assert.isFalse(failed);
		})
		
		it("should return a rejected promise if a single passed function fails", function* () {
			var numConcurrent = 2;
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var e = yield getPromiseError(caller.start(function () {
				throw new Error("Fail");
			}));
			assert.ok(e);
		})
		
		it("should stop on error if stopOnError is set", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
			var ids2 = ['n', 'o', 'p', 'q'];
			var makeFunc = function (id) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					var min = 10;
					var max = 25;
					yield Zotero.Promise.delay(
						Math.floor(Math.random() * (max - min + 1)) + min
					);
					if (id == 'g') {
						running--;
						finished++;
						Zotero.debug("Throwing " + id);
						// This causes an erroneous "possibly unhandled rejection" message in
						// Bluebird 2.10.2 that I can't seem to get rid of (and the rejection
						// is later handled), so tell Bluebird to ignore it
						let e = new Error("Fail");
						e.handledRejection = true;
						throw e;
					}
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			};
			var funcs1 = ids1.map(makeFunc)
			var funcs2 = ids2.map(makeFunc)
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				stopOnError: true,
				logger
			});
			var promise1 = caller.start(funcs1);
			var promise2 = caller.start(funcs2);
			
			var results1 = yield promise1;
			
			assert.isTrue(promise2.isFulfilled());
			assert.equal(running, 0);
			assert.isBelow(finished, ids1.length);
			assert.equal(results1.length, ids1.length);
			assert.equal(promise2.value().length, ids2.length);
			// 'a' should be fulfilled
			assert.isTrue(results1[0].isFulfilled());
			// 'g' should be rejected
			assert.isTrue(results1[6].isRejected());
			// 'm' should be rejected
			assert.isTrue(results1[12].isRejected());
			// All promises in second batch should be rejected
			assert.isTrue(promise2.value().every(p => p.isRejected()));
		})
		
		
		it("should not stop on error if stopOnError isn't set", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
			var ids2 = ['n', 'o', 'p', 'q'];
			var makeFunc = function (id) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					var min = 10;
					var max = 25;
					yield Zotero.Promise.delay(
						Math.floor(Math.random() * (max - min + 1)) + min
					);
					if (id == 'g') {
						running--;
						finished++;
						Zotero.debug("Throwing " + id);
						// This causes an erroneous "possibly unhandled rejection" message in
						// Bluebird 2.10.2 that I can't seem to get rid of (and the rejection
						// is later handled), so tell Bluebird to ignore it
						let e = new Error("Fail");
						e.handledRejection = true;
						throw e;
					}
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			};
			var funcs1 = ids1.map(makeFunc)
			var funcs2 = ids2.map(makeFunc)
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var promise1 = caller.start(funcs1);
			var promise2 = caller.start(funcs2);
			
			var results2 = yield promise2;
			
			assert.isTrue(promise1.isFulfilled());
			assert.isTrue(promise2.isFulfilled());
			assert.equal(running, 0);
			assert.equal(finished, ids1.length + ids2.length);
			assert.equal(promise1.value().length, ids1.length);
			assert.equal(results2.length, ids2.length);
			// 'a' should be fulfilled
			assert.isTrue(promise1.value()[0].isFulfilled());
			// 'g' should be rejected
			assert.isTrue(promise1.value()[6].isRejected());
			// 'm' should be fulfilled
			assert.isTrue(promise1.value()[12].isFulfilled());
			// All promises in second batch should be fulfilled
			assert.isTrue(results2.every(p => p.isFulfilled()));
		})
	})
	
	describe("#wait()", function () {
		it("should return when all tasks are done", function* () {
			var numConcurrent = 2;
			var running = 0;
			var finished = 0;
			var failed = false;
			
			var ids1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
			var ids2 = ['n', 'o', 'p', 'q'];
			var makeFunc = function (id) {
				return Zotero.Promise.coroutine(function* () {
					if (logger) {
						Zotero.debug("Running " + id);
					}
					running++;
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					var min = 10;
					var max = 25;
					yield Zotero.Promise.delay(
						Math.floor(Math.random() * (max - min + 1)) + min
					);
					if (running > numConcurrent) {
						failed = true;
						throw new Error("Too many concurrent tasks");
					}
					running--;
					finished++;
					if (logger) {
						Zotero.debug("Finished " + id);
					}
					return id;
				});
			};
			var funcs1 = ids1.map(makeFunc)
			var funcs2 = ids2.map(makeFunc)
			
			var caller = new ConcurrentCaller({
				numConcurrent,
				logger
			});
			var promise1 = caller.start(funcs1);
			yield Zotero.Promise.delay(10);
			var promise2 = caller.start(funcs2);
			
			yield caller.wait();
			
			assert.isTrue(promise1.isFulfilled());
			assert.isTrue(promise2.isFulfilled());
			assert.equal(running, 0);
			assert.equal(finished, ids1.length + ids2.length);
		})
	})
})
