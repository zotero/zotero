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
	var _conflicts = [];
	var _cancelled = false;
	
	
	/**
	 * Retrieving a queue, creating a new one if necessary
	 *
	 * @param	{String}		queueName
	 */
	this.get = function (queueName, noInit) {
		// Initialize the queue if it doesn't exist yet
		if (!_queues[queueName]) {
			if (noInit) {
				return false;
			}
			var queue = new Zotero.Sync.Storage.Queue(queueName);
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
			_queues[queueName] = queue;
		}
		
		return _queues[queueName];
	}
	
	
	this.getAll = function () {
		var queues = [];
		for each(var queue in _queues) {
			queues.push(queue);
		}
		return queues;
	};
	
	
	/**
	 * Stop all queues
	 *
	 * @param	{Boolean}	[skipStorageFinish=false]	Don't call Zotero.Sync.Storage.finish()
	 *													when done (used when we stopped because of
	 *													an error)
	 */
	this.cancel = function (skipStorageFinish) {
		Zotero.debug("Stopping all storage queues");
		_cancelled = true;
		for each(var queue in _queues) {
			if (queue.isRunning() && !queue.isStopping()) {
				queue.stop();
			}
		}
	}
	
	
	this.finish = function () {
		Zotero.debug("All storage queues are finished");
		
		if (!_cancelled && _conflicts.length) {
			var data = _reconcileConflicts();
			if (data) {
				_processMergeData(data);
			}
		}
		
		try {
			if (_cancelled) {
				Zotero.Sync.Storage.EventManager.stop();
			}
			else {
				Zotero.Sync.Storage.EventManager.success();
			}
		}
		finally {
			_cancelled = false;
			_conflicts = [];
		}
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
			this.updateProgressMeters(0);
			if (allFinished) {
				this.finish();
			}
			return;
		}
		
		// Percentage
		var percentageSum = 0;
		var numQueues = 0;
		for each(var queue in _queues) {
			percentageSum += queue.percentage;
			numQueues++;
		}
		var percentage = Math.round(percentageSum / numQueues);
		//Zotero.debug("Total percentage is " + percentage);
		
		// Remaining KB
		var downloadStatus = _queues.download ?
								_getQueueStatus(_queues.download) : 0;
		var uploadStatus = _queues.upload ?
								_getQueueStatus(_queues.upload) : 0;
		
		this.updateProgressMeters(
			activeRequests, percentage, downloadStatus, uploadStatus
		);
	}
	
	
	/**
	 * Cycle through windows, updating progress meters with new values
	 */
	this.updateProgressMeters = function (activeRequests, percentage, downloadStatus, uploadStatus) {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if (!win.ZoteroPane) continue;
			var doc = win.ZoteroPane.document;
			
			//
			// TODO: Move to overlay.js?
			//
			var box = doc.getElementById("zotero-tb-sync-progress-box");
			var meter = doc.getElementById("zotero-tb-sync-progress");
			
			if (activeRequests == 0) {
				box.hidden = true;
				continue;
			}
			
			meter.setAttribute("value", percentage);
			box.hidden = false;
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-progress");
			tooltip.setAttribute("value", percentage + "%");
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-downloads");
			tooltip.setAttribute("value", downloadStatus);
			
			var tooltip = doc.
				getElementById("zotero-tb-sync-progress-tooltip-uploads");
			tooltip.setAttribute("value", uploadStatus);
		}
	}
	
	
	this.addConflict = function (requestName, localData, remoteData) {
		Zotero.debug('===========');
		Zotero.debug(localData);
		Zotero.debug(remoteData);
		
		_conflicts.push({
			name: requestName,
			localData: localData,
			remoteData: remoteData
		});
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
			return Zotero.getString('sync.storage.none')
		}
		
		var kbRemaining = Zotero.getString(
			'sync.storage.kbRemaining',
			Zotero.Utilities.numberFormat(remaining / 1024, 0)
		);
		var totalRequests = queue.totalRequests;
		var filesRemaining = Zotero.getString(
			'sync.storage.filesRemaining',
			[totalRequests - unfinishedRequests, totalRequests]
		);
		var status = Zotero.localeJoin([kbRemaining, '(' + filesRemaining + ')']);
		return status;
	}
	
	
	function _reconcileConflicts() {
		var objectPairs = [];
		for each(var conflict in _conflicts) {
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
		for (var i=0; i<_conflicts.length; i++) {
			io.dataOut[i].id = Zotero.Sync.Storage.getItemFromRequestName(_conflicts[i].name).id;
		}
		
		return io.dataOut;
	}
	
	
	function _processMergeData(data) {
		if (!data.length) {
			return false;
		}
		
		Zotero.Sync.Storage.resyncOnFinish = true;
		
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
