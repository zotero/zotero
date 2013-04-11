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
 * Queue for storage sync transfer requests
 *
 * @param	{String}		type		Queue type (e.g., 'download' or 'upload')
 */
Zotero.Sync.Storage.Queue = function (type, libraryID) {
	Zotero.debug("Initializing " + type + " queue for library " + libraryID);
	
	// Public properties
	this.type = type;
	this.libraryID = libraryID;
	this.maxConcurrentRequests = 1;
	this.activeRequests = 0;
	this.totalRequests = 0;
	
	// Private properties
	this._requests = {};
	this._highPriority = [];
	this._running = false;
	this._stopping = false;
	this._finished = false;
	this._error = false;
	this._finishedReqs = 0;
	this._localChanges = false;
	this._remoteChanges = false;
	this._conflicts = [];
	this._cachedPercentage;
	this._cachedPercentageTime;
}

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('name', function () {
	return this.type + "/" + this.libraryID;
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('Type', function () {
	return this.type[0].toUpperCase() + this.type.substr(1);
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('running', function () this._running);
Zotero.Sync.Storage.Queue.prototype.__defineGetter__('stopping', function () this._stopping);
Zotero.Sync.Storage.Queue.prototype.__defineGetter__('finished', function () this._finished);

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('unfinishedRequests', function () {
	return this.totalRequests - this.finishedRequests;
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('finishedRequests', function () {
	return this._finishedReqs;
});

Zotero.Sync.Storage.Queue.prototype.__defineSetter__('finishedRequests', function (val) {
	Zotero.debug("Finished requests: " + val);
	Zotero.debug("Total requests: " + this.totalRequests);
	
	this._finishedReqs = val;
	
	if (val == 0) {
		return;
	}
	
	// Last request
	if (val == this.totalRequests) {
		Zotero.debug(this.Type + " queue is done for library " + this.libraryID);
		
		// DEBUG info
		Zotero.debug("Active requests: " + this.activeRequests);
		
		if (this.activeRequests) {
			throw new Error(this.Type + " queue for library " + this.libraryID
				+ " can't be done if there are active requests");
		}
		
		this._running = false;
		this._stopping = false;
		this._finished = true;
		this._requests = {};
		this._highPriority = [];
		
		var localChanges = this._localChanges;
		var remoteChanges = this._remoteChanges;
		var conflicts = this._conflicts.concat();
		var deferred = this._deferred;
		this._localChanges = false;
		this._remoteChanges = false;
		this._conflicts = [];
		this._deferred = null;
		
		if (!this._error) {
			Zotero.debug("Resolving promise for queue " + this.name);
			Zotero.debug(this._localChanges);
			Zotero.debug(this._remoteChanges);
			Zotero.debug(this._conflicts);
			
			deferred.resolve({
				libraryID: this.libraryID,
				type: this.type,
				localChanges: localChanges,
				remoteChanges: remoteChanges,
				conflicts: conflicts
			});
		}
		else {
			Zotero.debug("Rejecting promise for queue " + this.name);
			var e = this._error;
			this._error = false;
			e.libraryID = this.libraryID;
			e.type = this.type;
			deferred.reject(e);
		}
		
		return;
	}
	
	if (this._stopping) {
		return;
	}
	this.advance();
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('queuedRequests', function () {
	return this.unfinishedRequests - this.activeRequests;
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('remaining', function () {
	var remaining = 0;
	for each(var request in this._requests) {
		remaining += request.remaining;
	}
	return remaining;
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('percentage', function () {
	if (this.totalRequests == 0) {
		return 0;
	}
	if (this._finished) {
		return 100;
	}
	
	// Cache percentage for a second
	if (this._cachedPercentage && (new Date() - this._cachedPercentageTime) < 1000) {
		return this._cachedPercentage;
	}
	
	var completedRequests = 0;
	for each(var request in this._requests) {
		completedRequests += request.percentage / 100;
	}
	this._cachedPercentage = Math.round((completedRequests / this.totalRequests) * 100);
	this._cachedPercentageTime = new Date();
	return this._cachedPercentage;
});


Zotero.Sync.Storage.Queue.prototype.isRunning = function () {
	return this._running;
}

Zotero.Sync.Storage.Queue.prototype.isStopping = function () {
	return this._stopping;
}


/**
 * Add a request to this queue
 *
 * @param {Zotero.Sync.Storage.Request} request
 * @param {Boolean} highPriority  Add or move request to high priority queue
 */
Zotero.Sync.Storage.Queue.prototype.addRequest = function (request, highPriority) {
	if (this._finished) {
		this.reset();
	}
	
	request.queue = this;
	var name = request.name;
	Zotero.debug("Queuing " + this.type + " request '" + name + "' for library " + this.libraryID);
	
	if (this._requests[name]) {
		if (highPriority) {
			Zotero.debug("Moving " + name + " to high-priority queue");
			this._requests[name].importCallbacks(request);
			this._highPriority.push(name);
			return;
		}
		
		Zotero.debug("Request '" + name + "' already exists");
		return;
	}
	
	this._requests[name] = request;
	this.totalRequests++;
	
	if (highPriority) {
		this._highPriority.push(name);
	}
}


Zotero.Sync.Storage.Queue.prototype.start = function () {
	if (!this._deferred || this._deferred.promise.isFulfilled()) {
		Zotero.debug("Creating deferred for queue " + this.name);
		this._deferred = Q.defer();
	}
	// The queue manager needs to know what queues were running in the
	// current session
	Zotero.Sync.Storage.QueueManager.addCurrentQueue(this);
	
	var self = this;
	setTimeout(function () {
		self.advance();
	}, 0);
	
	return this._deferred.promise;
}



/**
 * Start another request in this queue if there's an available slot
 */
Zotero.Sync.Storage.Queue.prototype.advance = function () {
	this._running = true;
	this._finished = false;
	
	if (this._stopping) {
		Zotero.debug(this.Type + " queue for library " + this.libraryID
			+ "is being stopped in Zotero.Sync.Storage.Queue.advance()", 2);
		return;
	}
	
	if (!this.queuedRequests) {
		Zotero.debug("No remaining requests in " + this.type
			+ " queue for library " + this.libraryID + " ("
			+ this.activeRequests + " active, "
			+ this.finishedRequests + " finished)");
		return;
	}
	
	if (this.activeRequests >= this.maxConcurrentRequests) {
		Zotero.debug(this.Type + " queue for library " + this.libraryID
			+ " is busy (" + this.activeRequests + "/"
			+ this.maxConcurrentRequests + ")");
		return;
	}
	
	
	
	// Start the first unprocessed request
	
	// Try the high-priority queue first
	var self = this;
	var request, name;
	while (name = this._highPriority.shift()) {
		request = this._requests[name];
		if (request.isRunning() || request.isFinished()) {
			continue;
		}
		
		let requestName = name;
		
		Q.fcall(function () {
			var promise = request.start();
			self.advance();
			return promise;
		})
		.then(function (result) {
			if (result.localChanges) {
				self._localChanges = true;
			}
			if (result.remoteChanges) {
				self._remoteChanges = true;
			}
			if (result.conflict) {
				self.addConflict(
					requestName,
					result.conflict.local,
					result.conflict.remote
				);
			}
		})
		.catch(function (e) {
			self.error(e);
		});
		
		return;
	}
	
	// And then others
	for each(var request in this._requests) {
		if (request.isRunning() || request.isFinished()) {
			continue;
		}
		
		let requestName = request.name;
		
		// This isn't in an fcall() because the request needs to get marked
		// as running immediately so that it doesn't get run again by a
		// subsequent advance() call.
		try {
			var promise = request.start();
			self.advance();
		}
		catch (e) {
			self.error(e);
		}
		
		Q.when(promise)
		.then(function (result) {
			if (result.localChanges) {
				self._localChanges = true;
			}
			if (result.remoteChanges) {
				self._remoteChanges = true;
			}
			if (result.conflict) {
				self.addConflict(
					requestName,
					result.conflict.local,
					result.conflict.remote
				);
			}
		})
		.catch(function (e) {
			self.error(e);
		});
		
		return;
	}
}


Zotero.Sync.Storage.Queue.prototype.updateProgress = function () {
	Zotero.Sync.Storage.QueueManager.updateProgress();
}


Zotero.Sync.Storage.Queue.prototype.addConflict = function (requestName, localData, remoteData) {
	Zotero.debug('===========');
	Zotero.debug(localData);
	Zotero.debug(remoteData);
	
	this._conflicts.push({
		name: requestName,
		localData: localData,
		remoteData: remoteData
	});
}


Zotero.Sync.Storage.Queue.prototype.error = function (e) {
	if (!this._error) {
		if (this.isRunning()) {
			this._error = e;
		}
		else {
			Zotero.debug("Queue " + this.name + " was no longer running -- not assigning error", 2);
		}
	}
	Zotero.debug(e, 1);
	this.stop();
}


/**
 * Stops all requests in this queue
 */
Zotero.Sync.Storage.Queue.prototype.stop = function () {
	if (!this._running) {
		Zotero.debug(this.Type + " queue for library " + this.libraryID
			+ " is not running");
		return;
	}
	if (this._stopping) {
		Zotero.debug("Already stopping " + this.type + " queue for library "
			+ this.libraryID);
		return;
	}
	
	Zotero.debug("Stopping " + this.type + " queue for library " + this.libraryID);
	
	// If no requests, finish manually
	/*if (this.activeRequests == 0) {
		this._finishedRequests = this._finishedRequests;
		return;
	}*/
	
	this._stopping = true;
	for each(var request in this._requests) {
		if (!request.isFinished()) {
			request.stop(true);
		}
	}
	
	Zotero.debug("Queue is stopped");
}


Zotero.Sync.Storage.Queue.prototype.reset = function () {
	this._finished = false;
	this._finishedReqs = 0;
	this.totalRequests = 0;
}
