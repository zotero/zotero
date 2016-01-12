/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


/**
 * Transfer request for storage sync
 *
 * @param  {String}    name     Identifier for request (e.g., "[libraryID]/[key]")
 * @param  {Function}  onStart  Callback to run when request starts
 */
Zotero.Sync.Storage.Request = function (name, callbacks) {
	Zotero.debug("Initializing request '" + name + "'");
	
	this.callbacks = ['onStart', 'onProgress'];
	
	this.name = name;
	this.channel = null;
	this.queue = null;
	this.progress = 0;
	this.progressMax = 0;
	
	this._deferred = Q.defer();
	this._running = false;
	this._stopping = false;
	this._percentage = 0;
	this._remaining = null;
	this._maxSize = null;
	this._finished = false;
	this._forceFinish = false;
	this._changesMade = false;
	
	for (var func in callbacks) {
		if (this.callbacks.indexOf(func) !== -1) {
			// Stuff all single functions into arrays
			this['_' + func] = typeof callbacks[func] === 'function' ? [callbacks[func]] : callbacks[func];
		}
		else {
			throw new Error("Invalid handler '" + func + "'");
		}
	}
}


Zotero.Sync.Storage.Request.prototype.setMaxSize = function (size) {
	this._maxSize = size;
};


/**
 * Add callbacks from another request to this request
 */
Zotero.Sync.Storage.Request.prototype.importCallbacks = function (request) {
	for each(var name in this.callbacks) {
		name = '_' + name;
		if (request[name]) {
			// If no handlers for this event, add them all
			if (!this[name]) {
				this[name] = request[name];
				continue;
			}
			// Otherwise add functions that don't already exist
			var add = true;
			for each(var newFunc in request[name]) {
				for each(var currentFunc in this[name]) {
					if (newFunc.toString() === currentFunc.toString()) {
						Zotero.debug("Callback already exists in request -- not importing");
						add = false;
						break;
					}
				}
				if (add) {
					this[name].push(newFunc);
				}
			}
		}
	}
}


Zotero.Sync.Storage.Request.prototype.__defineGetter__('promise', function () {
	return this._deferred.promise;
});


Zotero.Sync.Storage.Request.prototype.__defineGetter__('percentage', function () {
	if (this._finished) {
		return 100;
	}
	
	if (this.progressMax == 0) {
		return 0;
	}
	
	var percentage = Math.round((this.progress / this.progressMax) * 100);
	if (percentage < this._percentage) {
		Zotero.debug(percentage + " is less than last percentage of "
			+ this._percentage + " for request " + this.name, 2);
		Zotero.debug(this.progress);
		Zotero.debug(this.progressMax);
		percentage = this._percentage;
	}
	else if (percentage > 100) {
		Zotero.debug(percentage + " is greater than 100 for "
			+ "request " + this.name, 2);
		Zotero.debug(this.progress);
		Zotero.debug(this.progressMax);
		percentage = 100;
	}
	else {
		this._percentage = percentage;
	}
	//Zotero.debug("Request '" + this.name + "' percentage is " + percentage);
	return percentage;
});


Zotero.Sync.Storage.Request.prototype.__defineGetter__('remaining', function () {
	if (this._finished) {
		return 0;
	}
	
	if (!this.progressMax) {
		if (this.queue.type == 'upload' && this._maxSize) {
			return Math.round(Zotero.Sync.Storage.compressionTracker.ratio * this._maxSize);
		}
		
		//Zotero.debug("Remaining not yet available for request '" + this.name + "'");
		return 0;
	}
	
	var remaining = this.progressMax - this.progress;
	if (this._remaining === null) {
		this._remaining = remaining;
	}
	else if (remaining > this._remaining) {
		Zotero.debug(remaining + " is greater than the last remaining amount of "
				+ this._remaining + " for request " + this.name);
		remaining = this._remaining;
	}
	else if (remaining < 0) {
		Zotero.debug(remaining + " is less than 0 for request " + this.name);
	}
	else {
		this._remaining = remaining;
	}
	//Zotero.debug("Request '" + this.name + "' remaining is " + remaining);
	return remaining;
});


Zotero.Sync.Storage.Request.prototype.setChannel = function (channel) {
	this.channel = channel;
}


Zotero.Sync.Storage.Request.prototype.start = function () {
	if (!this.queue) {
		throw ("Request " + this.name + " must be added to a queue before starting");
	}
	
	Zotero.debug("Starting " + this.queue.name + " request " + this.name);
	
	if (this._running) {
		throw new Error("Request " + this.name + " already running");
	}
	
	this._running = true;
	this.queue.activeRequests++;
	
	if (this.queue.type == 'download') {
		Zotero.Sync.Storage.setItemDownloadPercentage(this.name, 0);
	}
	
	var self = this;
	
	// this._onStart is an array of promises returning changesMade.
	//
	// The main sync logic is triggered here.
	
	Q.all(this._onStart.map(f => f(this)))
	.then(function (results) {
		return {
			localChanges: results.some(function (val) val && val.localChanges == true),
			remoteChanges: results.some(function (val) val && val.remoteChanges == true),
			conflict: results.reduce(function (prev, cur) {
				return prev.conflict ? prev : cur;
			}).conflict
		};
	})
	.then(function (results) {
		Zotero.debug(results);
		
		if (results.localChanges) {
			Zotero.debug("Changes were made by " + self.queue.name
				+ " request " + self.name);
		}
		else {
			Zotero.debug("No changes were made by " + self.queue.name
				+ " request " + self.name);
		}
		
		// This promise updates localChanges/remoteChanges on the queue
		self._deferred.resolve(results);
	})
	.catch(function (e) {
		if (self._stopping) {
			Zotero.debug("Skipping error for stopping request " + self.name);
			return;
		}
		Zotero.debug(self.queue.Type + " request " + self.name + " failed");
		self._deferred.reject(e);
	})
	// Finish the request (and in turn the queue, if this is the last request)
	.finally(function () {
		if (!self._finished) {
			self._finish();
		}
	});
	
	return this._deferred.promise;
}


Zotero.Sync.Storage.Request.prototype.isRunning = function () {
	return this._running;
}


Zotero.Sync.Storage.Request.prototype.isFinished = function () {
	return this._finished;
}


/**
 * Update counters for given request
 *
 * Also updates progress meter
 *
 * @param	{Integer}		progress			Progress so far
 *												(usually bytes transferred)
 * @param	{Integer}		progressMax		Max progress value for this request
 *												(usually total bytes)
 */
Zotero.Sync.Storage.Request.prototype.onProgress = function (channel, progress, progressMax) {
	//Zotero.debug(progress + "/" + progressMax + " for request " + this.name);
	
	if (!this._running) {
		Zotero.debug("Trying to update finished request " + this.name + " in "
				+ "Zotero.Sync.Storage.Request.onProgress() "
				+ "(" + progress + "/" + progressMax + ")", 2);
		return;
	}
	
	if (!this.channel) {
		this.channel = channel;
	}
	
	// Workaround for invalid progress values (possibly related to
	// https://bugzilla.mozilla.org/show_bug.cgi?id=451991 and fixed in 3.1)
	if (progress < this.progress) {
		Zotero.debug("Invalid progress for request '"
			+ this.name + "' (" + progress + " < " + this.progress + ")");
		return;
	}
	
	if (progressMax != this.progressMax) {
		Zotero.debug("progressMax has changed from " + this.progressMax
			+ " to " + progressMax + " for request '" + this.name + "'", 2);
	}
	
	this.progress = progress;
	this.progressMax = progressMax;
	this.queue.updateProgress();
	
	if (this.queue.type == 'download') {
		Zotero.Sync.Storage.setItemDownloadPercentage(this.name, this.percentage);
	}
	
	if (this.onProgress) {
		for each(var f in this._onProgress) {
			f(progress, progressMax);
		}
	}
}


/**
 * Stop the request's underlying network request, if there is one
 */
Zotero.Sync.Storage.Request.prototype.stop = function (force) {
	if (force) {
		this._forceFinish = true;
	}
	
	if (this.channel && this.channel.isPending()) {
		this._stopping = true;
		
		try {
			Zotero.debug("Stopping request '" + this.name + "'");
			this.channel.cancel(0x804b0002); // NS_BINDING_ABORTED
		}
		catch (e) {
			Zotero.debug(e);
		}
	}
	else {
		this._finish();
	}
}


/**
 * Mark request as finished and notify queue that it's done
 */
Zotero.Sync.Storage.Request.prototype._finish = function () {
	// If an error occurred, we wait to finish the request, since doing
	// so might end the queue before the error flag has been set on the queue.
	// When the queue's error handler stops the queue, it stops the request
	// with stop(true) to force the finish to occur, allowing the queue's
	// promise to be rejected with the error.
	if (!this._forceFinish && this._deferred.promise.isRejected()) {
		return;
	}
	
	Zotero.debug("Finishing " + this.queue.name + " request '" + this.name + "'");
	this._finished = true;
	var active = this._running;
	this._running = false;
	
	Zotero.Sync.Storage.setItemDownloadPercentage(this.name, false);
	
	if (active) {
		this.queue.activeRequests--;
	}
	// TEMP: mechanism for failures?
	try {
		this.queue.finishedRequests++;
		this.queue.updateProgress();
	}
	catch (e) {
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		this._deferred.reject(e);
		throw e;
	}
}
