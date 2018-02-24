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

var EXPORTED_SYMBOLS = ["ConcurrentCaller"];

if (!(typeof process === 'object' && process + '' === '[object process]')) {
	// Components.utils.import('resource://zotero/require.js');
	// Not using Cu.import here since we don't want the require module to be cached
	// for includes within ZoteroPane or other code where we want the window instance available to modules.
	Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader)
		.loadSubScript('resource://zotero/require.js');
	var Promise = require('resource://zotero/bluebird.js');
} else {
	Promise = require('bluebird');
}

/**
 * Call a fixed number of functions at once, queueing the rest until slots
 * open and returning a promise for the final completion. The functions do
 * not need to return promises, but they should if they have asynchronous
 * work to perform.
 *
 * Example:
 *
 *   var caller = new ConcurrentCaller({
 *       numConcurrent: 2,
 *       stopOnError: true
 *   });
 *   yield caller.start([foo, bar, baz, qux);
 *
 * In this example, foo and bar would run immediately, and baz and qux would
 * be queued for later. When foo or bar finished, baz would be run, followed
 * by qux when another slot opened.
 *
 * Additional functions can be added at any time with another call to start(). The promises for
 * all open start() calls will be resolved when all requests are finished.
 *
 * @param {Object} options
 * @param {Integer} options.numConcurrent - The number of concurrent functions to run.
 * @param {String} [options.id] - Identifier to use in debug output
 * @param {Boolean} [options.stopOnError]
 * @param {Function} [options.onError]
 * @param {Integer} [options.interval] - Interval between the end of one function run and the
 *     beginning of another, in milliseconds
 * @param {Function} [options.logger]
 * @param {Object} [options.Promise] The Zotero instance of Promise to allow
 *		stubbing/spying in tests
 */
var ConcurrentCaller = function (options = {}) {
	if (typeof options == 'number') {
		this._log("ConcurrentCaller now takes an object rather than a number");
		options = {
			numConcurrent: options
		};
	}
	
	if (!options.numConcurrent) throw new Error("numConcurrent must be provided");
	
	if (options.Promise) Promise = options.Promise;
	
	this.stopOnError = options.stopOnError || false;
	this.onError = options.onError || null;
	this.numConcurrent = options.numConcurrent;
	
	this._id = options.id;
	this._numRunning = 0;
	this._queue = [];
	this._logger = options.logger || null;
	this._interval = options.interval || 0;
	this._pausing = false;
	this._pauseUntil = 0;
	this._deferred = null;
};


ConcurrentCaller.prototype.setInterval = function (ms) {
	this._log("setInterval() is deprecated -- pass .interval to constructor");
	this._interval = ms;
};


ConcurrentCaller.prototype.setLogger = function (func) {
	this._log("setLogger() is deprecated -- pass .logger to constructor");
	this._logger = func;
};


/**
 * Don't run any new functions for the specified amount of time
 */
ConcurrentCaller.prototype.pause = function (ms) {
	this._pauseUntil = Date.now() + ms;
}


/**
 * Add a task to the queue without starting it
 *
 * @param {Function|Function[]} - One or more functions to run
 * @return {Promise|Promise<PromiseInspection[]>} - If one function is passed, a promise for the return
 *     value of the passed function; if multiple, a promise for an array of PromiseInspection objects
 *     for those functions, resolved once they have all finished, even if other functions are still running
 */
ConcurrentCaller.prototype.add = function (func) {
	if (Array.isArray(func)) {
		let promises = [];
		for (let i = 0; i < func.length; i++) {
			promises.push(this.start(func[i]).reflect());
		}
		return Promise.all(promises);
	}
	
	if (!this._deferred || !this._deferred.promise.isPending()) {
		this._deferred = Promise.defer();
	}
	
	var deferred = Promise.defer();
	this._queue.push({
		func: Promise.method(func),
		deferred: deferred
	});
	return deferred.promise;
}


/**
 * @param {Function|Function[]} - One or more functions to run
 * @return {Promise[]} - An array of promises for passed functions, resolved once they have all
 *     finished (even if other functions are still running)
 */
ConcurrentCaller.prototype.start = function (func) {
	var promise = this.add(func);
	var run = this._processNext();
	if (!run) {
		this._log("Already at " + this.numConcurrent + " -- queueing for later");
	}
	return promise;
}


/**
 * Start processing if not already running and wait for all tasks to complete
 *
 * @return {Promise[]} - An array of promises for all currently queued tasks
 */
ConcurrentCaller.prototype.runAll = function () {
	// If nothing queued, return immediately
	if (!this._deferred) {
		return Promise.resolve([]);
	}
	var promises = this._queue.map(x => x.deferred.promise);
	do {
		var run = this._processNext();
	}
	while (run);
	return this._deferred.promise.return(promises);
}


/**
 * Wait for all running tasks to complete
 *
 * @return {Promise}
 */
ConcurrentCaller.prototype.wait = function () {
	return this._deferred ? this._deferred.promise : Promise.resolve();
}


ConcurrentCaller.prototype.stop = function () {
	this._log("Clearing queue");
	this._queue = [];
};


ConcurrentCaller.prototype._processNext = function () {
	if (this._numRunning >= this.numConcurrent) {
		return false;
	}
	
	// If there's a function to call and we're under the concurrent limit, run it now
	var f = this._queue.shift();
	if (!f) {
		if (this._numRunning == 0 && !this._pausing) {
			this._log("All tasks are done");
			this._deferred.resolve();
		}
		else {
			this._log("Nothing left to run -- waiting for running tasks to complete");
		}
		return false;
	}
	
	this._log("Running function ("
		+ this._numRunning + "/" + this.numConcurrent + " running, "
		+ this._queue.length + " queued)");
	
	this._numRunning++;
	f.func().bind(this).then(function (value) {
		this._numRunning--;
		
		this._log("Done with function ("
			+ this._numRunning + "/" + this.numConcurrent + " running, "
			+ this._queue.length + " queued)");
		
		this._waitForPause().bind(this).then(function () {
			this._processNext();
		});
		
		f.deferred.resolve(value);
	})
	.catch(function (e) {
		this._numRunning--;
		
		this._log("Error in function (" + this._numRunning + "/" + this.numConcurrent + ", "
			+ this._queue.length + " in queue)"
			+ ((!this.onError && !this.stopOnError) ? ": " + e : ""));
		
		if (this.onError) {
			this.onError(e);
		}
		
		if (this.stopOnError && this._queue.length) {
			this._log("Stopping on error: " + e);
			this._oldQueue = this._queue;
			this._queue = [];
			for (let o of this._oldQueue) {
				//this._log("Rejecting promise");
				o.deferred.reject();
			}
		}
		
		this._waitForPause().bind(this).then(function () {
			this._processNext();
		});
		
		e.handledRejection = true;
		f.deferred.reject(e);
	});
	return true;
}


/**
 * Wait until the specified interval has elapsed or the current pause (if there is one) is over,
 * whichever is longer
 */
ConcurrentCaller.prototype._waitForPause = Promise.coroutine(function* () {
	let interval = this._interval;
	let now = Date.now();
	if (this._pauseUntil > now && (this._pauseUntil - now > interval)) {
		interval = this._pauseUntil - now;
	}
	this._pausing = true;
	yield Promise.delay(interval);
	this._pausing = false;
});


ConcurrentCaller.prototype._log = function (msg) {
	if (this._logger) {
		this._logger("[ConcurrentCaller] " + (this._id ? `[${this._id}] ` : "") + msg);
	}
};

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = ConcurrentCaller;
}
