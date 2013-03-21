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


Zotero.Sync.Storage.QueueManager = new function () {
	var _queues = {};
	var _currentQueues = [];
	
	this.start = function (libraryID) {
		if (libraryID === 0 || libraryID) {
			var queues = this.getAll(libraryID);
			var suffix = " for library " + libraryID;
		}
		else {
			var queues = this.getAll();
			var suffix = "";
		}
		
		Zotero.debug("Starting file sync queues" + suffix);
		
		var promises = [];
		for each(var queue in queues) {
			if (!queue.unfinishedRequests) {
				continue;
			}
			Zotero.debug("Starting queue " + queue.name);
			promises.push(queue.start());
		}
		
		if (!promises.length) {
			Zotero.debug("No files to sync" + suffix);
		}
		
		return Q.allResolved(promises)
			.then(function (promises) {
				Zotero.debug("All storage queues are finished" + suffix);
				
				promises.forEach(function (promise) {
					// Check for conflicts to resolve
					if (promise.isFulfilled()) {
						var result = promise.valueOf();
						if (result.conflicts.length) {
							Zotero.debug("Reconciling conflicts for library " + result.libraryID);
							Zotero.debug(result.conflicts);
							var data = _reconcileConflicts(result.conflicts);
							if (data) {
								_processMergeData(data);
							}
						}
					}
				});
				return promises;
			});
	};
	
	this.stop = function (libraryID) {
		if (libraryID === 0 || libraryID) {
			var queues = this.getAll(libraryID);
		}
		else {
			var queues = this.getAll();
		}
		for (var queue in queues) {
			queue.stop();
		}
	};
	
	
	/**
	 * Retrieving a queue, creating a new one if necessary
	 *
	 * @param	{String}		queueName
	 */
	this.get = function (queueName, libraryID, noInit) {
		if (typeof libraryID == 'undefined') {
			throw new Error("libraryID not specified");
		}
		
		var hash = queueName + "/" + libraryID;
		
		// Initialize the queue if it doesn't exist yet
		if (!_queues[hash]) {
			if (noInit) {
				return false;
			}
			var queue = new Zotero.Sync.Storage.Queue(queueName, libraryID);
			switch (queueName) {
				case 'download':
					queue.maxConcurrentRequests =
						Zotero.Prefs.get('sync.storage.maxDownloads')
					break;
				
				case 'upload':
					queue.maxConcurrentRequests =
						Zotero.Prefs.get('sync.storage.maxUploads')
					break;
				
				default:
					throw ("Invalid queue '" + queueName + "' in Zotero.Sync.Storage.QueueManager.get()");
			}
			_queues[hash] = queue;
		}
		
		return _queues[hash];
	};
	
	
	this.getAll = function (libraryID) {
		if (typeof libraryID == 'string') {
			throw new Error("libraryID must be a number or undefined");
		}
		
		var queues = [];
		for each(var queue in _queues) {
			if (typeof libraryID == 'undefined' || queue.libraryID === libraryID) {
				queues.push(queue);
			}
		}
		return queues;
	};
	
	
	this.addCurrentQueue = function (queue) {
		if (!this.hasCurrentQueue(queue)) {
			_currentQueues.push(queue.name);
		}
	}
	
	
	this.hasCurrentQueue = function (queue) {
		return _currentQueues.indexOf(queue.name) != -1;
	}
	
	
	/**
	 * Stop all queues
	 *
	 * @param	{Boolean}	[skipStorageFinish=false]	Don't call Zotero.Sync.Storage.finish()
	 *													when done (used when we stopped because of
	 *													an error)
	 */
	this.cancel = function (skipStorageFinish) {
		Zotero.debug("Stopping all storage queues");
		for each(var queue in _queues) {
			if (queue.isRunning() && !queue.isStopping()) {
				queue.stop();
			}
		}
	}
	
	
	this.finish = function () {
		Zotero.debug("All storage queues are finished");
		_currentQueues = [];
	}
	
	
	/**
	 * Calculate the current progress values and trigger a display update
	 *
	 * Also detects when all queues have finished and ends sync progress
	 */
	this.updateProgress = function () {
		var activeRequests = 0;
		var allFinished = true;
		for each(var queue in _queues) {
			// Finished or never started
			if (!queue.isRunning() && !queue.isStopping()) {
				continue;
			}
			allFinished = false;
			activeRequests += queue.activeRequests;
		}
		if (activeRequests == 0) {
			_updateProgressMeters(0);
			if (allFinished) {
				this.finish();
			}
			return;
		}
		
		var status = {};
		for each(var queue in _queues) {
			if (!this.hasCurrentQueue(queue)) {
				continue;
			}
			
			if (!status[queue.libraryID]) {
				status[queue.libraryID] = {};
			}
			if (!status[queue.libraryID][queue.type]) {
				status[queue.libraryID][queue.type] = {};
			}
			status[queue.libraryID][queue.type].statusString = _getQueueStatus(queue);
			status[queue.libraryID][queue.type].percentage = queue.percentage;
			status[queue.libraryID][queue.type].totalRequests = queue.totalRequests;
			status[queue.libraryID][queue.type].finished = queue.finished;
		}
		
		_updateProgressMeters(activeRequests, status);
	}
	
	
	/**
	 * Get a status string for a queue
	 *
	 * @param	{Zotero.Sync.Storage.Queue}		queue
	 * @return	{String}
	 */
	function _getQueueStatus(queue) {
		var remaining = queue.remaining;
		var unfinishedRequests = queue.unfinishedRequests;
		
		if (!unfinishedRequests) {
			return Zotero.getString('sync.storage.none');
		}
		
		if (remaining > 1000) {
			var bytesRemaining = Zotero.getString(
				'sync.storage.mbRemaining',
				Zotero.Utilities.numberFormat(remaining / 1000 / 1000, 1)
			);
		}
		else {
			var bytesRemaining = Zotero.getString(
				'sync.storage.kbRemaining',
				Zotero.Utilities.numberFormat(remaining / 1000, 0)
			);
		}
		var totalRequests = queue.totalRequests;
		var filesRemaining = Zotero.getString(
			'sync.storage.filesRemaining',
			[totalRequests - unfinishedRequests, totalRequests]
		);
		return bytesRemaining + ' (' + filesRemaining + ')';
	}
	
	/**
	 * Cycle through windows, updating progress meters with new values
	 */
	function _updateProgressMeters(activeRequests, status) {
		// Get overall percentage across queues
		var sum = 0, num = 0, percentage, total;
		for each(var libraryStatus in status) {
			for each(var queueStatus in libraryStatus) {
				percentage = queueStatus.percentage;
				total = queueStatus.totalRequests;
				sum += total * percentage;
				num += total;
			}
		}
		var percentage = Math.round(sum / num);
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if (!win.ZoteroPane) continue;
			var doc = win.ZoteroPane.document;
			
			var box = doc.getElementById("zotero-tb-sync-progress-box");
			var meter = doc.getElementById("zotero-tb-sync-progress");
			
			if (activeRequests == 0) {
				box.hidden = true;
				continue;
			}
			
			meter.setAttribute("value", percentage);
			box.hidden = false;
			
			var percentageLabel = doc.getElementById('zotero-tb-sync-progress-tooltip-progress');
			percentageLabel.lastChild.setAttribute('value', percentage + "%");
			
			var statusBox = doc.getElementById('zotero-tb-sync-progress-status');
			statusBox.data = status;
		}
	}
	
	
	function _reconcileConflicts(conflicts) {
		var objectPairs = [];
		for each(var conflict in conflicts) {
			var item = Zotero.Sync.Storage.getItemFromRequestName(conflict.name);
			var item1 = item.clone(false, false, true);
			item1.setField('dateModified',
				Zotero.Date.dateToSQL(new Date(conflict.localData.modTime), true));
			var item2 = item.clone(false, false, true);
			item2.setField('dateModified',
				Zotero.Date.dateToSQL(new Date(conflict.remoteData.modTime), true));
			objectPairs.push([item1, item2]);
		}
		
		var io = {
			dataIn: {
				type: 'storagefile',
				captions: [
					Zotero.getString('sync.storage.localFile'),
					Zotero.getString('sync.storage.remoteFile'),
					Zotero.getString('sync.storage.savedFile')
				],
				objects: objectPairs
			}
		};
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
		
		if (!io.dataOut) {
			return false;
		}
		
		// Since we're only putting cloned items into the merge window,
		// we have to manually set the ids
		for (var i=0; i<conflicts.length; i++) {
			io.dataOut[i].id = Zotero.Sync.Storage.getItemFromRequestName(conflicts[i].name).id;
		}
		
		return io.dataOut;
	}
	
	
	function _processMergeData(data) {
		if (!data.length) {
			return false;
		}
		
		for each(var mergeItem in data) {
			var itemID = mergeItem.id;
			var dateModified = mergeItem.ref.getField('dateModified');
			// Local
			if (dateModified == mergeItem.left.getField('dateModified')) {
				Zotero.Sync.Storage.setSyncState(
					itemID, Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD
				);
			}
			// Remote
			else {
				Zotero.Sync.Storage.setSyncState(
					itemID, Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD
				);
			}
		}
	}
}
