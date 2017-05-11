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
 * @param {Object} options
 * @param {String} options.type
 * @param {Integer} options.libraryID
 * @param {String} options.name - Identifier for request (e.g., "[libraryID]/[key]")
 * @param {Function|Function[]} [options.onStart]
 * @param {Function|Function[]} [options.onProgress]
 * @param {Function|Function[]} [options.onStop]
 */
Zotero.Sync.Storage.Request = function (options) {
	if (!options.type) throw new Error("type must be provided");
	if (!options.libraryID) throw new Error("libraryID must be provided");
	if (!options.name) throw new Error("name must be provided");
	['type', 'libraryID', 'name'].forEach(x => this[x] = options[x]);
	
	Zotero.debug(`Initializing ${this.type} request ${this.name}`);
	
	this.callbacks = ['onStart', 'onProgress', 'onStop'];
	
	this.Type = Zotero.Utilities.capitalize(this.type);
	this.channel = null;
	this.queue = null;
	this.progress = 0;
	this.progressMax = 0;
	
	this._deferred = Zotero.Promise.defer();
	this._running = false;
	this._stopping = false;
	this._percentage = 0;
	this._remaining = null;
	this._maxSize = null;
	this._finished = false;
	
	for (let name of this.callbacks) {
		if (!options[name]) continue;
		this['_' + name] = Array.isArray(options[name]) ? options[name] : [options[name]];
	}
}


Zotero.Sync.Storage.Request.prototype.setMaxSize = function (size) {
	this._maxSize = size;
};


/**
 * Add callbacks from another request to this request
 */
Zotero.Sync.Storage.Request.prototype.importCallbacks = function (request) {
	for (let name of this.callbacks) {
		name = '_' + name;
		if (request[name]) {
			// If no handlers for this event, add them all
			if (!this[name]) {
				this[name] = request[name];
				continue;
			}
			// Otherwise add functions that don't already exist
			var add = true;
			for (let newFunc of request[name]) {
				for (let currentFunc of this[name]) {
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
		if (this.type == 'upload' && this._maxSize) {
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


Zotero.Sync.Storage.Request.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting " + this.type + " request " + this.name);
	
	if (this._running) {
		throw new Error(this.type + " request " + this.name + " already running");
	}
	
	if (!this._onStart) {
		throw new Error("onStart not provided -- nothing to do!");
	}
	
	this._running = true;
	
	// this._onStart is an array of promises for objects of result flags, which are combined
	// into a single object here
	//
	// The main sync logic is triggered here.
	try {
		var results = yield Zotero.Promise.all(this._onStart.map(f => f(this)));
		
		var result = new Zotero.Sync.Storage.Result;
		result.updateFromResults(results);
		
		Zotero.debug(this.Type + " request " + this.name + " finished");
		Zotero.debug(result + "");
		
		return result;
	}
	catch (e) {
		Zotero.logError(this.Type + " request " + this.name + " failed");
		throw e;
	}
	finally {
		this._finished = true;
		this._running = false;
		
		Zotero.Sync.Storage.setItemDownloadPercentage(this.name, false);
		
		if (this._onStop) {
			this._onStop.forEach(x => x());
		}
	}
});


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
Zotero.Sync.Storage.Request.prototype.onProgress = function (progress, progressMax) {
	//Zotero.debug(progress + "/" + progressMax + " for request " + this.name);
	
	if (!this._running) {
		Zotero.debug("Trying to update finished request " + this.name + " in "
				+ "Zotero.Sync.Storage.Request.onProgress() "
				+ "(" + progress + "/" + progressMax + ")", 2);
		return;
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
	
	if (this.type == 'download') {
		Zotero.Sync.Storage.setItemDownloadPercentage(this.name, this.percentage);
	}
	
	if (this._onProgress) {
		for (let f of this._onProgress) {
			f(progress, progressMax);
		}
	}
}


/**
 * Stop the request's underlying network request, if there is one
 */
Zotero.Sync.Storage.Request.prototype.stop = function (force) {
	if (this.channel && this.channel.isPending()) {
		this._stopping = true;
		
		try {
			Zotero.debug(`Stopping ${this.type} request '${this.name} '`);
			this.channel.cancel(0x804b0002); // NS_BINDING_ABORTED
		}
		catch (e) {
			Zotero.debug(e, 1);
		}
	}
}
