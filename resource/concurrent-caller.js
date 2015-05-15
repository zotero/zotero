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
Components.utils.import("resource://zotero/bluebird.js");

/**
 * Call a fixed number of functions at once, queueing the rest until slots
 * open and returning a promise for the final completion. The functions do
 * not need to return promises, but they should if they have asynchronous
 * work to perform.
 *
 * Example:
 *
 *   var caller = new ConcurrentCaller(2);
 *   caller.stopOnError = true;
 *   caller.fcall([foo, bar, baz, qux);
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
	this.onError = null;
	
	this._numConcurrent = numConcurrent;
	this._numRunning = 0;
	this._queue = [];
	this._logger = null;
	this._interval = 0;
	this._pauseUntil = 0;
};


/**
 * Set the interval between the end of one function run and the beginning
 * of another, in milliseconds
 */
ConcurrentCaller.prototype.setInterval = function (ms) {
	this._interval = ms;
};


ConcurrentCaller.prototype.setLogger = function (func) {
	this._logger = func;
};


/**
 * Don't run any new functions for the specified amount of time
 */
ConcurrentCaller.prototype.pause = function (ms) {
	this._pauseUntil = Date.now() + ms;
}


/**
 * @param {Function[]|Function} func  One or more functions to run
 */
ConcurrentCaller.prototype.fcall = function (func) {
	if (Array.isArray(func)) {
		var promises = [];
		for (let i = 0; i < func.length; i++) {
			promises.push(this.fcall(func[i]));
		}
		return Promise.settle(promises);
	}
	
	// If we're at the maximum number of concurrent functions,
	// queue this function for later
	if (this._numRunning == this._numConcurrent) {
		this._log("Already at " + this._numConcurrent + " -- queueing for later");
		var deferred = Promise.defer();
		this._queue.push({
			func: Promise.method(func),
			deferred: deferred
		});
		return deferred.promise;
	}
	
	this._numRunning++;
	
	// Otherwise run it now
	this._log("Running function (" + this._numRunning + "/" + this._numConcurrent + ")");
	
	return this._onFunctionDone(Promise.try(func));
}


ConcurrentCaller.prototype.stop = function () {
	this._log("Clearing queue");
	this._queue = [];
};


ConcurrentCaller.prototype._onFunctionDone = function (promise) {
	var self = this;
	
	return promise.then(function (result) {
		self._numRunning--;
		
		self._log("Done with function ("
			+ self._numRunning + "/" + self._numConcurrent + " running, "
			+ self._queue.length + " queued)");
		
		return result;
	})
	.catch(function (e) {
		self._numRunning--;
		
		self._log("Error in function (" + self._numRunning + "/" + self._numConcurrent + ", "
			+ self._queue.length + " in queue)");
		
		if (self.onError) {
			self.onError(e);
		}
		
		if (self.stopOnError && self._queue.length) {
			self._log("Stopping on error: " + e);
			self._queue = [];
		}
		
		throw e;
	})
	.finally(function () {
		// If there's a function to call and we're under the concurrent limit, run it now
		var f = self._queue.shift();
		if (f && self._numRunning < self._numConcurrent) {
			// Wait until the specified interval has elapsed or the current
			// pause (if there is one) is over, whichever is longer
			let interval = self._interval;
			let now = Date.now();
			if (self._pauseUntil > now && (self._pauseUntil - now > interval)) {
				interval = self._pauseUntil - now;
			}
			Promise.delay(interval)
			.then(function () {
				self._log("Running new function ("
					+ self._numRunning + "/" + self._numConcurrent + " running, "
					+ self._queue.length + " queued)");
				
				self._numRunning++;
				f.deferred.resolve(self._onFunctionDone(f.func()));
			});
		}
	});
};


ConcurrentCaller.prototype._log = function (msg) {
	if (this._logger) {
		this._logger("[ConcurrentCaller] " + msg);
	}
};
