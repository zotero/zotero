/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
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

Zotero.ProgressQueue = function (options) {
	const OFFLINE_RECHECK_DELAY = 60 * 1000;
	
	let _id = options.id;
	let _title = options.title;
	let _columns = options.columns;
	let _processor = options.processor;
	
	let _listeners = {};
	let _rows = [];
	let _queue = [];
	let _queueProcessing = false;
	
	/**
	 * @return {Number}
	 */
	this.getID = function () {
		return _id;
	};
	
	
	/**
	 * @return {String}
	 */
	this.getTitle = function () {
		return _title;
	};
	
	
	/**
	 * @return {String[]}
	 */
	this.getColumns = function () {
		return _columns;
	};
	
	
	/**
	 * Add listener
	 * @param {String} name Event name
	 * @param callback
	 */
	this.addListener = function (name, callback) {
		_listeners[name] = callback;
	};
	
	
	/**
	 * Remove listener
	 * @param {String} name Event name
	 */
	this.removeListener = function (name) {
		delete _listeners[name];
	};
	
	
	/**
	 * Adds items to the queue and triggers processing
	 * @param {Zotero.Item[]} items
	 */
	this.addItems = function (items) {
		for (let item of items) {
			_addItem(item);
		}
		_processQueue();
	};
	
	
	/**
	 * Returns all rows
	 * @return {Object[]}
	 */
	this.getRows = function () {
		return _rows;
	};
	
	
	/**
	 * Returns rows count
	 * @return {Number}
	 */
	this.getTotal = function () {
		return _rows.length;
	};
	
	
	/**
	 * Returns processed rows count
	 * @return {Number}
	 */
	this.getProcessedTotal = function () {
		return _rows.filter(row => row.status > Zotero.ProgressQueue.ROW_PROCESSING).length;
	};
	
	
	/**
	 * Stop processing items
	 */
	this.cancel = function () {
		_queue = [];
		_rows = [];
		if (_listeners.empty) {
			_listeners.empty();
		}
	};
	
	
	/**
	 * Add item for processing
	 * @param {Zotero.Item} item
	 */
	function _addItem(item) {
		// Check if item is already in the list
		for (let row of _rows) {
			if (row.id === item.id) {
				// If it's already processed, delete the existing row
				// and allow to add it again for reprocessing
				if (row.status > Zotero.ProgressQueue.ROW_PROCESSING) {
					_deleteRow(row.id);
					break;
				}
				// If it's still waiting to be processed just ignore it
				return;
			}
		}
		
		let row = {
			id: item.id,
			status: Zotero.ProgressQueue.ROW_QUEUED,
			fileName: item.getField('title'),
			message: ''
		};
		
		_rows.unshift(row);
		_queue.unshift(item.id);
		
		if (_listeners.rowadded) {
			_listeners.rowadded(row);
		}
		
		if (_listeners.nonempty && _rows.length === 1) {
			_listeners.nonempty();
		}
	}
	
	
	/**
	 * Update row status and message
	 * @param {Number} itemID
	 * @param {Number} status
	 * @param {String} message
	 */
	function _updateRow(itemID, status, message) {
		for (let row of _rows) {
			if (row.id === itemID) {
				row.status = status;
				row.message = message;
				if (_listeners.rowupdated) {
					_listeners.rowupdated({
						id: row.id,
						status,
						message: message || ''
					});
				}
				return;
			}
		}
	}
	
	
	/**
	 * Delete row
	 * @param {Number} itemID
	 */
	function _deleteRow(itemID) {
		for (let i = 0; i < _rows.length; i++) {
			let row = _rows[i];
			if (row.id === itemID) {
				_rows.splice(i, 1);
				if (_listeners.rowdeleted) {
					_listeners.rowdeleted({
						id: row.id
					});
				}
				return;
			}
		}
	}
	
	
	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 */
	async function _processQueue() {
		await Zotero.Schema.schemaUpdatePromise;
		
		if (_queueProcessing) return;
		_queueProcessing = true;
		
		while (1) {
			// While all current progress queue usages are related with
			// online APIs, check internet connectivity here
			if (Zotero.HTTP.browserIsOffline()) {
				await Zotero.Promise.delay(OFFLINE_RECHECK_DELAY);
				continue;
			}
			
			let itemID = _queue.shift();
			if (!itemID) break;
			
			_updateRow(itemID, Zotero.ProgressQueue.ROW_PROCESSING, Zotero.getString('general.processing'));
			
			try {
				let item = await Zotero.Items.getAsync(itemID);
				
				if (!item) {
					throw new Error();
				}
				
				let res = await _processor(item);
				_updateRow(itemID, Zotero.ProgressQueue.ROW_SUCCEEDED, res);
			}
			catch (e) {
				Zotero.logError(e);
				
				_updateRow(
					itemID,
					Zotero.ProgressQueue.ROW_FAILED,
					e instanceof Zotero.Exception.Alert
						? e.message
						: Zotero.getString('general.error')
				);
			}
		}
		
		_queueProcessing = false;
	}
};


Zotero.ProgressQueue.ROW_QUEUED = 1;
Zotero.ProgressQueue.ROW_PROCESSING = 2;
Zotero.ProgressQueue.ROW_FAILED = 3;
Zotero.ProgressQueue.ROW_SUCCEEDED = 4;


Zotero.ProgressQueues = new function () {
	let _queues = [];
	
	/**
	 * @param {Object} options
	 * @return {Zotero.ProgressQueue}
	 */
	this.createQueue = function (options) {
		let queue = new Zotero.ProgressQueue(options);
		_queues.push(queue);
		return queue;
	};
	
	/**
	 * @param {Number} id
	 * @return {Zotero.ProgressQueue}
	 */
	this.getQueue = function (id) {
		return _queues.find(queue => queue.getID() === id);
	};
	
	/**
	 * @return {Zotero.ProgressQueue[]}
	 */
	this.getAllQueues = function () {
		return _queues;
	};
};
