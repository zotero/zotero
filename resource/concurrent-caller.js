/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

EXPORTED_SYMBOLS = ["ConcurrentCaller"];
Components.utils.import("resource://zotero/q.js");

/**
 * Call a fixed number of functions at once, queueing the rest until slots
 * open and returning a promise for the final completion. The functions do
 * not need to return promises, but they should if they have asynchronous
 * work to perform..
 *
 * Example:
 *
 *   var caller = new ConcurrentCaller(2);
 *   caller.stopOnError = true;
 *   caller.fcall([foo, bar, baz, qux).done();
 *
 * In this example, foo and bar would run immediately, and baz and qux would
 * be queued for later. When foo or bar finished, baz would be run, followed
 * by qux when another slot opened.
 *
 * @param {Integer} numConcurrent The number of concurrent functions to run.
 */
ConcurrentCaller = function (numConcurrent) {
	if (typeof numConcurrent == 'undefined') {
		throw new Error("numConcurrent not provided");
	}
	
	this.stopOnError = false;
	
	this.numConcurrent = numConcurrent;
	this.numRunning = 0;
	this.queue = [];
	this.logger = null;
	this.errorLogger = null;
};


ConcurrentCaller.prototype.setLogger = function (func) {
	this.logger = func;
}


ConcurrentCaller.prototype.setErrorLogger = function (func) {
	this.errorLogger = func;
}


/**
 * @param {Function[]|Function} func  One or more functions to run
 */
ConcurrentCaller.prototype.fcall = function (func) {
	if (Array.isArray(func)) {
		var promises = [];
		for (var i in func) {
			//this._log("Running fcall on function");
			promises.push(this.fcall(func[i]));
		}
		return this.stopOnError ? Q.all(promises) : Q.allResolved(promises);
	}
	
	// If we're at the maximum number of concurrent functions,
	// queue this function for later
	if (this.numRunning == this.numConcurrent) {
		this._log("Already at " + this.numConcurrent + " -- queueing for later");
		var deferred = Q.defer();
		this.queue.push({
			func: Q.fbind(func),
			deferred: deferred
		});
		return deferred.promise;
	}
	
	this._log("Running function (" + this.numRunning + " current < " + this.numConcurrent + " max)");
	
	// Otherwise run it now
	this.numRunning++;
	return this._onFunctionDone(Q.fcall(func));
}


ConcurrentCaller.prototype._onFunctionDone = function (promise) {
	var self = this;
	return Q.when(
		promise,
		function (promise) {
			self.numRunning--;
			
			self._log("Done with function ("
				+ self.numRunning + "/" + self.numConcurrent + " running, "
				+ self.queue.length + " queued)");
			
			// If there's a function to call and we're under the concurrent limit,
			// run it now
			let f = self.queue.shift();
			if (f && self.numRunning < self.numConcurrent) {
				Q.delay(1)
				.then(function () {
					self.numRunning++;
					var p = self._onFunctionDone(f.func());
					f.deferred.resolve(p);
				});
			}
			
			return promise;
		},
		function (e) {
			if (self.errorLogger) {
				self.errorLogger(e);
			}
			
			self.numRunning--;
			
			self._log("Done with function (" + self.numRunning + "/" + self.numConcurrent + ", "
				+ self.queue.length + " in queue)");
			
			if (self.stopOnError && self.queue.length) {
				self._log("Stopping on error: " + e);
				self.queue = [];
			}
			
			throw e;
		}
	);
}


ConcurrentCaller.prototype._log = function (msg) {
	if (this.logger) {
		this.logger(msg);
	}
}
