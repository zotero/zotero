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
 * @param	{String}		name		Queue name (e.g., 'download' or 'upload')
 */
Zotero.Sync.Storage.Queue = function (name) {
	Zotero.debug("Initializing " + name + " queue");
	
	// Public properties
	this.name = name;
	this.maxConcurrentRequests = 1;
	this.activeRequests = 0;
	this.totalRequests = 0;
	
	// Private properties
	this._requests = {};
	this._highPriority = [];
	this._running = false;
	this._stopping = false;
	this._finishedReqs = 0;
	this._lastTotalRequests = 0;
}

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('Name', function () {
	return this.name[0].toUpperCase() + this.name.substr(1);
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('running', function () this._running);
Zotero.Sync.Storage.Queue.prototype.__defineGetter__('stopping', function () this._stopping);

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
		Zotero.debug(this.Name + " queue is done");
		
		// DEBUG info
		Zotero.debug("Active requests: " + this.activeRequests);
		
		if (this.activeRequests) {
			throw new Error(this.Name + " queue can't be done if there are active requests");
		}
		
		this._running = false;
		this._stopping = false;
		this._requests = {};
		this._highPriority = [];
		this._finishedReqs = 0;
		this._lastTotalRequests = this.totalRequests;
		this.totalRequests = 0;
		
		return;
	}
	
	if (this._stopping) {
		return;
	}
	this.advance();
});

Zotero.Sync.Storage.Queue.prototype.__defineGetter__('lastTotalRequests', function () {
	return this._lastTotalRequests;
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
	
	var completedRequests = 0;
	for each(var request in this._requests) {
		completedRequests += request.percentage / 100;
	}
	return Math.round((completedRequests / this.totalRequests) * 100);
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
	request.queue = this;
	var name = request.name;
	Zotero.debug("Queuing " + this.name + " request '" + name + "'");
	
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
	
	this.advance();
}


/**
 * Start another request in this queue if there's an available slot
 */
Zotero.Sync.Storage.Queue.prototype.advance = function () {
	this._running = true;
	
	if (this._stopping) {
		Zotero.debug(this.Name + " queue is being stopped in "
			+ "Zotero.Sync.Storage.Queue.advance()", 2);
		return;
	}
	
	if (!this.queuedRequests) {
		Zotero.debug("No remaining requests in " + this.name + " queue ("
			+ this.activeRequests + " active, "
			+ this.finishedRequests + " finished)");
		return;
	}
	
	if (this.activeRequests >= this.maxConcurrentRequests) {
		Zotero.debug(this.Name + " queue is busy ("
			+ this.activeRequests + "/" + this.maxConcurrentRequests + ")");
		return;
	}
	
	// Start the first unprocessed request
	
	// Try the high-priority queue first
	var name, request;
	while (name = this._highPriority.shift()) {
		request = this._requests[name];
		if (!request.isRunning() && !request.isFinished()) {
			request.start();
			this.advance();
			return;
		}
	}
	
	// And then others
	for each(request in this._requests) {
		if (!request.isRunning() && !request.isFinished()) {
			request.start();
			this.advance();
			return;
		}
	}
}


Zotero.Sync.Storage.Queue.prototype.updateProgress = function () {
	Zotero.Sync.Storage.QueueManager.updateProgress();
}


Zotero.Sync.Storage.Queue.prototype.error = function (e) {
	Zotero.Sync.Storage.EventManager.error(e);
}


/**
 * Stops all requests in this queue
 */
Zotero.Sync.Storage.Queue.prototype.stop = function () {
	if (!this._running) {
		Zotero.debug(this.Name + " queue is not running");
		return;
	}
	if (this._stopping) {
		Zotero.debug("Already stopping " + this.name + " queue");
		return;
	}
	
	// If no requests, finish manually
	/*if (this.activeRequests == 0) {
		this._finishedRequests = this._finishedRequests;
		return;
	}*/
	
	this._stopping = true;
	for each(var request in this._requests) {
		if (!request.isFinished()) {
			request.stop();
		}
	}
}
