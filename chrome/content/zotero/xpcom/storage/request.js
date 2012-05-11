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
 * @param  {Function}  onStop   Callback to run when request stops
 */
Zotero.Sync.Storage.Request = function (name, callbacks) {
	Zotero.debug("Initializing request '" + name + "'");
	
	this.callbacks = ['onStart', 'onProgress', 'onStop'];
	
	this.name = name;
	this.channel = null;
	this.queue = null;
	this.progress = 0;
	this.progressMax = 0;
	
	this._running = false;
	this._percentage = 0;
	this._remaining = null;
	this._finished = false;
	
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


Zotero.Sync.Storage.Request.prototype.__defineGetter__('percentage', function () {
	if (this.progressMax == 0) {
		return 0;
	}
	
	var percentage = Math.round((this.progress / this.progressMax) * 100);
	if (percentage < this._percentage) {
		Zotero.debug(percentage + " is less than last percentage of "
			+ this._percentage + " for request '" + this.name + "'", 2);
		Zotero.debug(this.progress);
		Zotero.debug(this.progressMax);
		percentage = this._percentage;
	}
	else if (percentage > 100) {
		Zotero.debug(percentage + " is greater than 100 for "
			+ this.name + " request", 2);
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
	if (!this.progressMax) {
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
		throw ("Request '" + this.name + "' must be added to a queue before starting");
	}
	
	if (this._running) {
		throw ("Request '" + this.name + "' already running in "
			+ "Zotero.Sync.Storage.Request.start()");
	}
	
	Zotero.debug("Starting " + this.queue.name + " request '" + this.name + "'");
	this._running = true;
	this.queue.activeRequests++;
	if (this._onStart) {
		for each(var f in this._onStart) {
			f(this);
		}
	}
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
	
	if (this.onProgress) {
		for each(var f in this._onProgress) {
			f(progress, progressMax);
		}
	}
}


Zotero.Sync.Storage.Request.prototype.error = function (e) {
	this.queue.error(e);
}


/**
 * Stop the request's underlying network request, if there is one
 */
Zotero.Sync.Storage.Request.prototype.stop = function () {
	var finishNow = false;
	try {
		// If upload already finished, finish() will never be called otherwise
		if (this.channel) {
			this.channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			// Throws error if request not finished
			this.channel.requestSucceeded;
			Zotero.debug("Channel is no longer running for request " + this.name);
			Zotero.debug(this.channel.requestSucceeded);
			finishNow = true;
		}
	}
	catch (e) {}
	
	if (!this._running || !this.channel || finishNow) {
		this.finish();
		return;
	}
	
	Zotero.debug("Stopping request '" + this.name + "'");
	this.channel.cancel(0x804b0002); // NS_BINDING_ABORTED
}


/**
 * Mark request as finished and notify queue that it's done
 */
Zotero.Sync.Storage.Request.prototype.finish = function () {
	if (this._finished) {
		throw ("Request '" + this.name + "' is already finished");
	}
	
	Zotero.debug("Finishing " + this.queue.name + " request '" + this.name + "'");
	this._finished = true;
	var active = this._running;
	this._running = false;
	
	if (active) {
		this.queue.activeRequests--;
	}
	// mechanism for failures?
	this.queue.finishedRequests++;
	this.queue.updateProgress();
	
	if (this._onStop) {
		for each(var f in this._onStop) {
			f();
		}
	}
}
